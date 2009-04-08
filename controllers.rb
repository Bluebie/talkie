module UserInterface::Controllers
  class Login < R '/openid'
    def get
      OpenID::Util.logger.sev_threshold = Logger::WARN
      
      # return to login if canceled
      return redirect('/') if input['openid.mode'] == 'cancel'
      
      this_url = URL(Login).to_s
      unless input.finish.to_s == '1'
        # start doing the auth here
        begin
          @state.openid_request = Hash.new
          oid_request = OpenID::Consumer.new(@state.openid_request, nil).begin(input.identity)
          # start sreg
          sreg = OpenID::SReg::Request.new
          sreg.request_fields(['nickname', 'fullname'], false)
          oid_request.add_extension(sreg)
          # attribute exchange (more modern)
#           ax = OpenID::AX::FetchRequest.new
#           ax.add OpenID::AX::AttrInfo.new('http://axschema.org/namePerson/friendly', 'nickname', false)
#           ax.add OpenID::AX::AttrInfo.new('http://axschema.org/namePerson', 'fullname', false)
#           ax.add OpenID::AX::AttrInfo.new('http://axschema.org/media/image/default', 'image', false)
#           ax.add OpenID::AX::AttrInfo.new('http://axschema.org/media/image/aspect11', 'square_image', false)
#           ax.add OpenID::AX::AttrInfo.new('http://axschema.org/media/biography', 'bio', false)
#           @state.openid_ax = Marshal.dump(ax)
#           oid_request.add_extension(ax)
          # end sreg
          oid_request.return_to_args['finish'] = '1'
          redirect(oid_request.redirect_url(URL('/').to_s, this_url))
        rescue OpenID::DiscoveryFailure
          return err('Couldn\'t find an OpenID at that address, are you sure it is one?')
        end
      else
        # finish the auth here
        response = OpenID::Consumer.new(@state.openid_request || {}, nil).complete(input, this_url)
        @state.delete('openid_request')
        case response.status
        when OpenID::Consumer::SUCCESS
          @state.identity = response.identity_url.to_s
          # start sreg
          sreg = OpenID::SReg::Response.from_success_response(response)
          unless sreg.empty?
            @state.default_username = sreg['fullname'] || sreg['nickname'] || nil
          end
          # ax stuff
#           ax = OpenID::AX::FetchResponse.from_success_response(response)
#           req_ax = Marshal.restore(@state.delete('openid_ax'))
#           return JSON.generate(ax.get_extension_args(req_ax)) if ax
          # end sreg
          grab_avatar
          when_done = @cookies.once_logged_in
          @cookies.delete('once_logged_in')
          return redirect(when_done || Home)
        when OpenID::Consumer::FAILURE
          return err('The OpenID thing doesn\'t think you really are that person, they said: ' + response.message)
        else
          return err('Crazy response is crazy: ' + response.inspect)
        end
      end
    end
    
    private
    
    def err(msg)
      @error = msg.to_s
      render :login
    end
    
    def grab_avatar
      require 'json'
      profile = JSON.parse(IO.read("#{userdir}/profile"))
      return if profile['user-uploaded-avatar']
      pavatar = get_remote_avatar(@state.identity) rescue nil
      
      if pavatar
        File.open("#{userdir}/pavatar", 'w') { |w| w.write(pavatar) }
        import_avatar(userdir, "#{userdir}/pavatar")
      end
    end
  end
  
  class Logout < R '/logout'
    def get
      @state.delete('identity')
      @cookies.authed = 'nope'
      @cookies.delete('login_error')
      redirect '/'
    end
  end
  
  
  class Welcome < R '/'
    def get
      if @state.identity
        redirect Home
      else
        render :login
      end
    end
  end
  
  
  class Home < R '/home'
    def get
      require_login or return
      require 'json'
      
      @profile = JSON.parse(IO.read("#{userdir}/profile"))
      
      @rooms = Array.new
      Dir.entries('rooms').each do |folder|
        next if folder.match(/^--/)
        next unless File.exist?("rooms/#{folder}/settings")
        room = {'url' => URL(Room, folder), 'id' => folder, 'last-id' => IO.read("rooms/#{folder}/message-counter").to_i, 'last-beat' => File.mtime("rooms/#{folder}/active-members")}
        room.merge! JSON.parse(IO.read("rooms/#{folder}/settings"))
        @rooms << room
      end
      
      @rooms.sort! { |a,b| 0 - (a['last-beat'] <=> b['last-beat']) }
      
      render :home
    end
  end
  
  class MergeProfile < R '/merge-profile'
    def post
      require_login or return
      require 'json'
      return 'meanie' if input.prop.length > 500 || input.value.length > 5000
      return 'unsupported prop' unless ['name', 'desc'].include?(input.prop)
      return 'name must be > 0 letters' if input.prop == 'name' && input.value.length == 0
      profile = JSON.parse(IO.read("#{userdir}/profile"))
      profile[input.prop] = input.value
      File.open("#{userdir}/profile", 'w') { |w| w.write(JSON.generate(profile)) }
    end
  end
  
  class AlterAvatar < R '/alter-avatar/(\w+)/(\w+)'
    def post(kind, action)
      require_login or return
      return unless kind == 'user' || user_owns_room?(input.room)
      
      dir = (kind == 'user') ? userdir : "rooms/#{input.room}"
      case action
      when 'remove'
        File.delete("#{dir}/avatar-80.png")
        File.delete("#{dir}/avatar-16.png")
        alter_json("#{dir}/profile") { |profile| profile.delete('user-uploaded-avatar') } if kind == 'user'
      when 'upload'
        File.open("#{dir}/avatar-original", 'w') { |w| w.write(input.upload[:tempfile].read) }
        import_avatar(dir, "#{dir}/avatar-original")
        alter_json("#{dir}/profile") { |profile| profile['user-uploaded-avatar'] = true } if kind == 'user'
        return '<!doctype html><html><head><script>window.name = "y";</script></head></html>'
      end
    end
  end
  
  class CreateRoom < R '/rooms/create'
    def get
      require_login or return
      render :create_room
    end
    
    def post
      if input.room_id.match(/[^a-z0-9-]/)
        @error = 'Room ID cannot contain anything except english letters, numbers, and hyphens'
        render :create_room
      elsif input.room_id.match(/^--/)
        @error = 'Room ID cannot start with two hyphens'
        render :create_room
      elsif input.room_id.match(/create/i)
        @error = 'Room cannot contain the word “create”'
        render :create_room
      elsif File.exist?("rooms/#{input.room_id}")
        @error = 'Room already exists, choose another URL'
        render :create_room
      else
        require 'json'
        
        default_settings = {
          :title => input.room_id.gsub(/\-/, ' ').capitalize,
          :desc => "Newly created room",
          :owners => [@state.identity],
          :type => 'democracy'
        }
        
        Dir.mkdir("rooms/#{input.room_id}")
        Dir.mkdir("rooms/#{input.room_id}/active-members")
        File.open("rooms/#{input.room_id}/active-users", 'w')     { |f| f.write('[]') }
        File.open("rooms/#{input.room_id}/message-counter", 'w')  { |f| f.write('0') }
        File.open("rooms/#{input.room_id}/settings", 'w')         { |f| f.write(JSON.generate(default_settings)) }
        File.open("rooms/#{input.room_id}/state", 'w')            { |f| f.write('{}') }
        
        File.chmod(0777, "rooms/#{input.room_id}", "rooms/#{input.room_id}/active-members")
        File.chmod(0666, "rooms/#{input.room_id}/active-users",
                         "rooms/#{input.room_id}/message-counter",
                         "rooms/#{input.room_id}/settings",
                         "rooms/#{input.room_id}/state")
        
        redirect RoomSettings, input.room_id
      end
    end
  end
  
  
  class CreateTempRoom < R '/rooms/create-temporary'
    def get
      require 'json'
      len = 16
      room_id = "--#{rand((2 ** len) - 1).to_s(36)}" and len = 64 until !File.exist?("rooms/#{room_id}")
      
      default_settings = {
        :title => input.name || "Temporary #{AppName} Room",
        :desc => input.desc || "",
        :interface => input.interface || 'chatie',
        :owners => [],
        :type => 'democracy'
      }
      
      Dir.mkdir("rooms/#{room_id}")
      Dir.mkdir("rooms/#{room_id}/active-members")
      File.open("rooms/#{room_id}/active-users", 'w')     { |f| f.write('[]') }
      File.open("rooms/#{room_id}/message-counter", 'w')  { |f| f.write('0') }
      File.open("rooms/#{room_id}/settings", 'w')         { |f| f.write(JSON.generate(default_settings)) }
      File.open("rooms/#{room_id}/state", 'w')            { |f| f.write('{}') }
      
      TempRoomCleaner.wakeup
      
      File.chmod(0777, "rooms/#{room_id}", "rooms/#{room_id}/active-members")
      File.chmod(0666, "rooms/#{room_id}/active-users",
                       "rooms/#{room_id}/message-counter",
                       "rooms/#{room_id}/settings",
                       "rooms/#{room_id}/state")
      
      send_message(room_id,
        :type => 'text/x-talkie-action',
        :from => talkie_user,
        :body => "created this temporary room for #{input.for || 'unknown user'}."
      )
      
      headers['Content-Type'] = 'text/plain'
      URL(ShortURL, room_id).to_s
    end
  end
  
  
  class Room < R '/rooms/([a-z0-9-]+)/chat'
    def get(room)
      require_login or return
      require 'json'
      @room = room
      return render(:room_gone) unless File.exist?("rooms/#{room}")
      @settings = JSON.parse(IO.read("rooms/#{room}/settings"))
      @smilies = Hash.new; base_url = URL("/#{room_or_default(room, 'smilies/thing')}")
      JSON.parse(IO.read(room_or_default(room, 'smilies/index.json'))).each do |file, codes|
        next if file.to_s.length == 0
        next unless codes.is_a?(Array) && codes.length > 0
        next unless File.exist?(room_or_default(room, "smilies/#{file}"))
        codes = codes.to_s.split(' ').map { |c| c.strip }.select { |c| c.length > 0 } unless codes.is_a?(Array)
        @smilies[base_url.merge(file.to_s)] = codes.map { |i| i.to_s.strip }
      end
      
      render :chat
    end
  end
  
  class LeaveRoom < R '/rooms/([a-z0-9-]+)/leave'
    def get(room)
      require_login or return
      require 'json'
      
      send_message(room, {
        'type' => 'application/x-talkie-user-leaves',
        'from' => @state.identity, 'body' => 'left.'}
      ) if (File.delete("rooms/#{room}/active-members/#{userhash}") rescue false)
      
      redirect Home
    end
  end
  
  class RoomSettings < R '/rooms/([a-z0-9-]+)/setup'
    def get(room)
      require_login or return
      return redirect(R(Room, room)) unless user_owns_room?(room)
      require 'json'
      @room = room
      @settings = JSON.parse(IO.read("rooms/#{room}/settings"))
      render :room_settings
    end
    
    def post(room)
      raise "You do not own #{room}, cannot save settings" unless user_owns_room?(room)
      @room = room
      alter_json("rooms/#{room}/settings") do |settings|
        @settings = settings
        settings['title'] = input.title
        settings['desc'] = input.desc
        settings['background'] ||= {}
        settings['background']['enabled'] = input.background_enabled == 'on'
        if input.background_colour.match(/^\#([0-9a-f]{6})$/i)
          settings['background']['colour']  = input.background_colour
        else
          raise 'Background Colour is not in #1212FF web format.'
        end
        settings['background']['url']     = input.background_url
        settings['background']['repeat']  = input.repeat_background
        settings['gagged']                = input.gagged.split("\n")
        settings['bot'] ||= {}
        settings['bot']['enabled']        = input.bot_enabled == 'on'
        settings['bot']['url']            = input.bot_url
        
        FileUtils.touch("rooms/#{room}/state")
        alter_text("rooms/#{room}/state") { "{}" } if settings['interface'] != input.interface
        settings['interface']             = input.interface.gsub(/[^a-z-]/, '')
      end
      
      File.open("rooms/#{room}/bot-error-allowance", 'w') { |f| f.write('100') }
      FileUtils.cp("rooms/#{room}/message-counter", "rooms/#{room}/bot-last-message")
      File.chmod(0666, "rooms/#{room}/bot-error-allowance", "rooms/#{room}/bot-last-message")
      
      begin
        url = URI.parse(input.bot_url)
        raise 'Bot URL is not a http:// web address' unless url.scheme.downcase == 'http'
      rescue
        raise 'Error parsing Bot URL. Bot will not function till fixed.'
      end unless input.bot_url.to_s.empty?
      
      #send_message(room, 'type' => 'application/x-talkie-reload', 'from' => @state.identity)
      send_message(room, 'type' => 'text/x-talkie-action', 'from' => @state.identity, :body => 'changed the room settings. You might want to reload the page to receive any updates, don’t have to though. :)')
      redirect Room, room
    rescue Object
      @error = $!.to_s
      render :room_settings
    end
  end
  
  class EraseRoom < R '/rooms/([a-z0-9-]+)/erase'
    def get(room)
      return "You do not own #{room}, cannot remove content" unless user_owns_room?(room)
      
      f = File.open("rooms/#{room}/message-counter", 'r')
      f.flock(File::LOCK_EX)
      Dir.entries("rooms/#{room}").each do |file|
        File.delete("rooms/#{room}/#{file}") if file =~ /^message\-([0-9]+)/
      end
      f.close
      
      send_message(room, 'type' => 'application/x-talkie-room-cleared', 'from' => @state.identity, 'body' => 'removed all previous messages.')
      
      redirect Room, room
    end
  end
  
  class DestroyRoom < R '/rooms/([a-z0-9-]+)/destroy'
    def get(room)
      return "You do not own #{room}, cannot remove content" unless user_owns_room?(room)
      send_message(room, 'type' => 'application/x-talkie-go-home', 'from' => @state.identity, 'body' => 'deleted the room. You don\'t have to go home, but you can\'t stay here.')
      sleep(2)
      FileUtils.rm_rf("rooms/#{room}")
      redirect Home
    end
  end
  
  class SendMessage < R '/rooms/([a-z0-9-]+)/send'
    def post(room)
      return error('You seem to have logged out, so your message couldn’t be sent. Leave the room and log back in to continue.') unless @state.identity
      @settings = JSON.parse(IO.read("rooms/#{room}/settings"))
      return error('You’ve been gagged. :/') if (@settings['gagged'] || []).include?(@state.identity)
      
      send_message(room, 'type' => 'application/x-talkie-user-enters', 'from' => @state.identity, 'body' => 'entered.') unless File.exist?("rooms/#{room}/active-members/#{userhash}")
      FileUtils.touch("rooms/#{room}/active-members/#{userhash}")
      
      return fileupload(room) if input.upload
      
      src_msg = JSON.parse(input.message)
      message = {'from' => @state.identity, 'type' => src_msg['type'] || 'text/plain', 'body' => src_msg['body'] || ''}
      err = validate(message) and return error(err) # check it's valid
      id = send_message(room, message)
      
      # clear out old junk
      # TODO: Archive this stuff in to html stuff in rooms which enable logs
      backlog_size = 500
      until_id = id - backlog_size
      while File.exist?("rooms/#{room}/message-#{until_id}")
        File.delete("rooms/#{room}/message-#{until_id}")
        until_id -= 1
      end if id > backlog_size
      
      BotNotifier[:from] = URL('/').to_s
      BotNotifier[:queue].push(room) if (@settings['bot'] || {})['enabled']
      
      if input.state && input.state_type && input.state_operation
        new_state = JSON.parse(input.state)
        return error("Cannot set state to be a #{new_state.class.name}") unless new_state.is_a?(Hash)
        
        state_file = {
          'individual' => "/rooms/#{room}/active-members/#{userhash}",
          'global' => "/rooms/#{room}/state"
        }[input.state_type]
        
        alter_json(state_file) do |statey|
          old_state = statey.dup
          case input.state_operation
          when 'shallow-merge'
            new_state.each { |k,v| statey[k] = v }
          when 'deep-merge'
            merger = lambda do |subject, overlay|
              overlay.each do |k,v|
                if v.is_a?(Hash)
                  merger.call(subject[k], v)
                else
                  subject[k] = v
                end
              end
            end
            
            merger.call(statey, new_state)
          when 'replace'
            statey = new_state
          end
          statey = old_state if statey.to_s.length > 10_000
        end
      end
      
      return JSON.generate(message.merge('success' => true, 'id' => id))
    rescue
      return error("#{$!}\n#{$@.join("\n")}")
    end
    
    def validate(message)
      return 'Cannot send application/x-talkie-... typed messages' if message['type'] =~ /^application\/x\-talkie/i
      return 'Cannot send message over 5kb big: ' + message['body'] if message['body'].length > 5_120
      # for custom applications requiring server side validation, add more here
      nil
    end
    
    def error(text)
      JSON.generate('success' => false, 'error' => text.to_s)
    end
    
    def fileupload(room)
      require 'rack/mime'
      return "Couldn't send file, as it is too large" if input.upload[:tempfile].size > 5_000_000
      File.open("rooms/#{room}/temp-#{userhash}", 'w') do |file|
        file.write(input.upload[:tempfile].read)
      end
      ext = input.upload[:filename].split(/\./).last.downcase
      ext = 'unknown' if ext.length > 4 || ['pif', 'com', 'bat', 'lnk', 'url', 'html', 'htm', 'shtml', 'xml', 'rss', 'xhtml', 'xhtm', 'mml', 'svg', 'php', 'php3', 'php4', 'rb', 'ru', 'py', 'pl'].include?(ext.downcase)
      mime = Rack::Mime.mime_type(".#{ext}", input.upload[:type])
      id = send_message(room, 'from' => @state.identity, 'type' => 'application/x-talkie-file', 'body' => {'extension' => ext, 'filename' => input.upload[:filename] || 'file', 'type' => mime})
      File.rename("rooms/#{room}/temp-#{userhash}", "rooms/#{room}/message-#{id}-file.#{ext}")
      
      # clear out old files past 3
      files = []
      Dir.foreach("rooms/#{room}") do |filename|
        next unless filename =~ /^message\-([0-9]+)\-file/
        files << [$1.to_i, filename]
      end
      files.sort! { |a, b| a.first <=> b.first }
      File.delete("rooms/#{room}/#{files.shift.last}") while files.length > 3
      
      return '<!doctype html><html><head><script>window.name = "y";</script></head></html>'
    end
  end
  
  class ShortURL < R('/r:([a-z0-9-]+)')
    def get(room)
      redirect Room, room
    end
  end
  
  class CatchMissingFile < R('/rooms/([a-z0-9-]+)/message\-[0-9]+\-file(.*)')
    def get(room, ext)
      render :generic_error, "Uploaded file removed", "This file has been removed to conserve storage space, as at least three more files have been uploaded since this one. You can contact the original sender to upload it again if needed. Sorry about that. :)"
    end
  end
end