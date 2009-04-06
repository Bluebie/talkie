module UserInterface::Views

  def layout
    @auto_validation = false
    @headers['Content-Type'] = 'application/xhtml+xml' if @input['xmlhdr']
    self << "<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n"
    self << "<!DOCTYPE html>\n<html xmlns=\"http://www.w3.org/1999/xhtml\">"
    tag!(:head) do
      meta :charset => 'utf-8'
      title (@title && @title != AppName) ? "#{@title} — #{AppName}" : AppName
      meta :name => 'viewport', :content => 'width=666; maximum-scale=1.0;'
      link :rel => 'stylesheet', :href => "#{@root}/style/sheet.css?last-modified=#{File.mtime('style/sheet.css').to_i}"
      #load_scripts 'mootools-1.2.1-core-yc.js', 'mootools-1.2.1-more-rc01-multi-more.js', 'core.js', 'cufon-yui.js', 'Complete_in_Him_400.font.js'
      script :src => "#{@root}/script/compiled?last-modified=#{File.mtime('script').to_i}"
      script do
        text "Cufon.replace('.text');"
        text "soundManager.url = '#{@root}/script/soundmanager/swf/';"
        text "window.urlroot = #{JSON.generate(@root)};"
        text "window.room = #{JSON.generate(@room)};" if @room
        text "window.settings = #{JSON.generate(@settings)};" if @settings
        text "window.openid = #{JSON.generate(@state.identity)};" if @state.identity
        text "window.smiliesData = #{JSON.generate(@smilies)};" if @smilies
      end
      @headstuff.call if @headstuff
    end
    body do
      yield
      #script("Cufon.now();") if @env['HTTP_USER_AGENT'] =~ /Microsoft/
    end
    self << "</html>"
  end
  
  def login
    @headstuff = lambda do
      load_scripts 'login.js'
      @headers['X-XRDS-Location'] = URL('/xrds.xml').to_s
    end
    
    regularContainer do
      div.bar.top do
        barTitle("#{AppName} Chats")
      end
      
      p.intro "#{AppName} is a tiny little place to chat. Built to be beautiful and simple. A place for creative people of all styles. Come on in and bring your friends! This peaceful community is dedicated to maintaining a high standard of chatter, so leave your loopholes at the door. If you have an idea on how to make #{AppName} an even better place to be, speak up in the Feedback room once you login!"
      
      div.rule { hr }
      
      div.bar.loginForm! do
        span "Login using your", :class => 'text typeface-js'
        select.idp! { }
        
        span.extra.directedID! { span 'identity', :class => 'text typeface-js' }
        span.extra.IDURL! do
          span 'URL:', :class => 'text typeface-js'
          input :value => 'http://', :id => 'openid', :name => 'openid_identifier'
        end
        span.extra.usernameID! do
          span 'username', :class => 'text typeface-js'
          input.username! :value => ''
        end
        
        button("Continue", :right, :id => 'login')
      end
      
      div.error @error if @error
      noscript { div.error("Javascript is required to use #{AppName}. Enable it in your browser preferences.") }
    end
  end
  
  def home
    @headstuff = proc do
      load_scripts 'home.js' #, 'swiff.uploader.js'
      script "var userDir = '/#{userdir}';"
    end
    
    regularContainer do
      div.bar.top do
        barTitle("Chat Rooms")
        div.lefted { button('Logout', :left, :href => R(Logout)) }
        div.righted { button('New Room', :href => R(CreateRoom)) }
      end
      
      div.scroll do
        div.profile.editable do
          img.ender :src => "#{@root}/style/user-profile-top.png"
          
          a.bigAvatarEdit.userAv! do
            div.pie { img :src => "#{@root}/style/progress-pie.png" }
            if File.exist?("#{userdir}/avatar-80.png")
              time = File.mtime("#{userdir}/avatar-80.png")
              img :src => "#{@root}/#{userdir}/avatar-80.png?#{time.to_i}", :id => 'userAvImg'
            else
              img :src => "#{@root}/style/default-avatar-80.png", :id => 'userAvImg'
            end
            img :src => "#{@root}/style/icon-hover-overlay.png", :class => 'overlay'
            img :src => "#{@root}/style/sidebar-pavatar-rounding.png", :class => 'rounding'
            span.menu do
              span.uploadAvatar! 'Upload Picture'
              span.removeAvatar! 'Remove Picture'
            end
          end
          
          input.name! :value => @profile['name']
          textarea.desc! @profile['desc']
          
          img.ender.clearer :src => "#{@root}/style/user-profile-bottom.png"
        end
        
        rule
        
        div.rooms do
          @rooms[0...6].each do |room|
            a(:class => "roomButton #{'dead' if room['last-beat'].to_i < Time.now.to_i - 60*10}", :href => room['url']) do
              img.ender :src => "#{@root}/style/room-square-top.png"
              roomav = room_or_default(room['id'], 'avatar-80.png')
              img.bigAvatar(:src => "#{@root}/style/sidebar-pavatar-rounding.png",
                            :style => 'background-image: url("' + @root + '/' + roomav + '?' + File.mtime(roomav).to_i.to_s + '")')
              div.title { span.text(room['title']) }
              p room['desc']
              img.ender.clearer :src => "#{@root}/style/room-square-bottom.png"
            end
          end
        end
        
        if @rooms[6..-1]
          rule
          div.rooms do
            @rooms[6..-1].each do |room|
              little_favatar_link(room)
            end
          end
        end
      end
    end
  end
  
  
  def chat
    @headstuff = proc do
      ui_root = "#{@root}/UIs/#{@settings['interface'] || 'chatie'}"
      link :href => "#{ui_root}/styles.css", :rel => 'stylesheet'
      script "window.ui_root = #{JSON.generate(ui_root + '/')};"
      script :src => "#{ui_root}/script.js"
      link :rel => 'shortcut icon', :href => "#{@root}/#{room_or_default(@room, 'avatar-16.png')}", :type => 'image/png'
    end
    
    ''
  end
  
  def room_gone
    @status = 410
    regularContainer do
      div.bar.top do
        div.lefted { button('Back', :left, :onclick => 'history.go(-1)') }
        div.centered { barTitle('Room Gone') }
      end
      
      div.error "The room ‘#{@room}’ isn’t anywhere on this server. Perhaps the owner deleted it, or perhaps it was removed for lack of use."
    end
  end
  
  def create_room
    @headstuff = proc { script 'window.addEvent("load", function() { $("room_id").focus(); });' }
    
    regularContainer do
      div.bar.top do
        div.lefted { button('Cancel', :left, :href => R(Home)) }
        div.centered { barTitle('Create Room') }
      end
      
      if @error
        div.error @error
      end
      
      div.bigBlock do
        img.ender :src => "#{@root}/style/user-profile-top.png"
        div.body do
          div 'Choose a web address:'
          form.url.url_creator!(:method => 'post') do
            span URL("/rooms/").to_s
            input.room_id! :type => 'text', :value => @input.room_id || ''
            span "/chat"
            button('Create', :right, :onclick => '$("url_creator").submit()')
          end
          div 'You can use lower cased english letters, numbers, and hyphens'
        end
        img.ender :src => "#{@root}/style/user-profile-bottom.png"
      end
    end
  end
  
  def room_settings
    @headstuff = proc do
      load_scripts 'settings.js' # 'swiff.uploader.js'
      script "window.room = #{JSON.generate(@room)};"
    end
    
    regularContainer('settingsBody') do
      div.bar.top do
        div.lefted { button('Cancel', :left, :href => R(Room, @room)) }
        div.centered { barTitle('Room Settings') }
        div.righted { button('Save', :onclick => '$("settingsForm").submit();') }
      end
      
      
      div.error(@error) if @error
      
      form.settingsForm!.bigBlock(:method => 'post') do
        img.ender :src => "#{@root}/style/user-profile-top.png"
        dl.body do
          dt 'Room Name:'
          dd { input.title! :value => @settings['title'] }
          
          dt 'Description:'
          dd { textarea.desc! @settings['desc'] }
          
          dt 'Room Interface:'
          dd do
            select.interface! do
              Dir.foreach('UIs') do |ui|
                next if ui.match(/^\./)
                option(ui.capitalize, (@settings['interface'] || 'chatie') == ui ? {:value => ui, :selected => 'yes'} : {:value => ui})
              end
            end
          end
          
          dt 'Icon:'
          dd do
            a.bigAvatarEdit.roomAv! do
              div.pie { img :src => "#{@root}/style/progress-pie.png" }
              time = File.mtime(room_or_default(@room, 'avatar-80.png'))
              img :src => "#{@root}/#{room_or_default(@room, 'avatar-80.png')}?#{time.to_i}", :id => 'roomAvImg'
              img :src => "#{@root}/style/icon-hover-overlay.png", :class => 'overlay'
              img :src => "#{@root}/style/sidebar-pavatar-rounding.png", :class => 'rounding'
              span.menu do
                span.uploadAvatar! 'Upload Picture'
                span.removeAvatar! 'Remove Picture'
              end
            end
          end
          
          dd.gap { hr }
          
          @settings['background'] ||= {} # incase it isn't there
          
          dt 'Use Custom Background?'
          dd { input.background_enabled!({:type => 'checkbox'}.merge(@settings['background']['enabled']?{:checked=>'checked'}:{})) }
          
          dt 'Background Colour:'
          dd { input.colour.background_colour! :value => @settings['background']['colour'] || '#8FB359' }
          
          dt 'Background Image URL:'
          dd { input.url.background_url! :value => @settings['background']['url'] || '' }
          
          dt 'Repeat Background Image?'
          dd { input.repeat_background!({:type => 'checkbox'}.merge((@settings['background']['repeat'] || true)?{:checked=>'checked'}:{})) }
          
          dd.gap { hr }
          
          dt 'Gagged Users'
          dd do
            input.gagged! :type => 'hidden', :value => (@settings['gagged'] || []).join("\n")
            div.list_of_gagged! {}
            span do
              text 'OpenID: '
              input.url :id => 'add_gag', :value => 'http://...'
              button 'Add Gag', :id => 'add_gag_btn'
            end
          end
          
          dd.gap { hr }
          
          @settings['bot'] ||= {'enabled' => false, 'url' => ''}
          
          dt 'Enable Robot:'
          dd { input.bot_enabled!({:type => 'checkbox'}.merge(@settings['bot']['enabled']?{:checked=>'checked'}:{})) }
          
          dt 'Robot URL:'
          dd { input.url.bot_url! :value => @settings['bot']['url'] }
          
          dd.gap { hr }
          
          dt 'Erase Data:'
          dd do
            div { button('Remove All Messages', :href => R(EraseRoom, @room)) }
            div { button('Delete Room Forever', :href => R(DestroyRoom, @room)) }
          end
        end
        img.ender :src => "#{@root}/style/user-profile-bottom.png"
      end
    end
  end
  
  def generic_error(title, message)
    regularContainer {
      div.bar.top { div.lefted { button('Back', :left, :onclick => 'history.go(-1)') }; barTitle(title || "error") }
      p.intro message.to_s
    }
  end
  
  
  private
  
  def load_scripts(*scripts)
    scripts.each do |script|
      script(:src => "#{@root}/script/#{script}?modified=#{File.mtime('script/'+script).to_i}")
    end
  end
  
  def regularContainer(classy = 'regularBody body', &content)
    div.regularContainer.container { div(:class => classy, &content); div.footer {} }
  end
  
  def barTitle(text)
    @title = text
    div.title { span.text(text) }
  end
  
  # second argument can be a direction, in symbol form, left, right, or square
  def button(text, *args)
    direction = args.first.is_a?(Symbol) ? args.shift : :square
    attributes = args.shift || {}
    a(attributes.merge(:class => "button #{direction}")) { em {}; text text }
  end
  
  def rule; div.rule { hr }; end
  
  def sidebarBoxy(*attribs, &inside)
    div.boxy(*attribs) do
      img.ender.top :src => "#{@root}/style/sidebar-rect-top.png"
      div.body { inside.call }
      img.ender.bottom :src => "#{@root}/style/sidebar-rect-bottom.png"
    end
  end
  
  def little_favatar_link(room)
    a(:href => R(Room, room['id']), :class => "little_av #{'dead' if room['last-beat'] < Time.now - 60*10}") do
      av_path = room_or_default(room['id'], 'avatar-16.png')
      img.favatar(
        :src => "#{@root}/style/sidebar-favicon-rounding.png",
        :style => "background-image: url(#{@root}/#{av_path}?last-modified=#{File.mtime(av_path).to_i});"
      )
      span room['title'].to_s
    end
  end
end
