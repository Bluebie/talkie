module UserInterface; end

module UserInterface::Helpers
  # defaults to this user, otherwise, supply their openid
  def userdir(user = false)
    require 'json'
    @userdir_cache ||= {}
    return @userdir_cache[user] if @userdir_cache[user]
    @state ||= Camping::H[{}]; @cookies ||= {}
    
    user = @state.identity unless user
    folder = "users/#{userhash(user)}"
    unless File.exist?(folder)
      profile = {
        'name' => @state.default_username || ((@cookies['idp-username'].to_s.length > 0)?@cookies['idp-username']:nil) || 'Anonymous',
        'desc' => 'You should fill out a name above and a little profiley thing here. :)'
      }
      
      Dir.mkdir(folder, 0777)
      File.open("#{folder}/openid", 'w') { |w| w.write(user) }
      File.open("#{folder}/profile", 'w') { |w| w.write(JSON.generate(profile)) }
    end
    return (@userdir_cache[user] = folder)
  end
  
  def userhash(user = false)
    require 'digest/sha1'
    folder = Digest::SHA1.hexdigest(user || @state.identity)
  end
  
  def talkie_user
    dir = userdir('http://talkie.me/')
    alter_json("#{dir}/profile") do |o|
      o['name'] = 'Talkie'
      o['desc'] = 'Talkie Bot'
    end
    'http://talkie.me/'
  end
  
  # discovers pavatars, or favicons
  def get_remote_avatar(from, type = :pavatar)
    require 'open-uri'; require 'nokogiri'
    from = URI.parse(from.to_s) unless from.is_a?(URI)
    raise StandardError.new('Evil is afoot!') unless ['http', 'https'].include?(from.scheme.downcase)
    
    source = open(from)
    
    if type == :pavatar
      return nil if source.meta['x-pavatar'] == 'none'
      if source.meta['x-pavatar']
        file = source.base_uri.merge(source.meta['x-pavatar']).read
        return file if file.status.first == '200'
      end
    end
    
    page = Nokogiri::HTML(source)
    rels = {:pavatar => 'pavatar', :favicon => 'icon'}
    link = page.css("*[rel~='#{rels[type]}']").first
    return source.base_uri.merge(link['href']).read if link
    
    extension = {:favicon => '.ico', :pavatar => '.png'}[type]
    
    if type == :pavatar
      tested = source.base_uri.merge("#{type}#{extension}").read
      return tested unless tested.status.first == '200'
    end
    
    tested = source.base_uri.merge("/#{type}#{extension}").read
    return tested unless tested.status.first == '200'
    
    return nil
  end
  
  # imports some avatar image, doing the resizing, in to the place
  def import_avatar(place, filename)
    [16, 80].each do |size|
      system('convert', filename, '-resize', "x#{size*2}", '-resize', "#{size*2}x<", '-resize', '50%', '-gravity', 'center', '-background', 'white', '-flatten', '+repage', '-crop', "#{size}x#{size}+0+0", '-quality','95', "PNG24:#{place}/avatar-#{size}.png")
    end
    
    File.delete(filename)
  end
  
  # simple question!
  def user_owns_room?(room = nil)
    return false unless @state.identity
    return true if ['http://creativepony.com/', 'https://me.yahoo.com/jennathepony#0fc3b'].include?(@state.identity)
    require 'json'
    @settings = JSON.parse(IO.read("rooms/#{room || @room}/settings")) unless @settings
    return @settings['owners'].include?(@state.identity)
  end
  
  # pick a path
  def room_or_default(room, path)
    if File.exist?("rooms/#{room}/#{path}")
      "rooms/#{room}/#{path}"
    else
      "default/room/#{path}"
    end
  end
  
  # open, lock, alter a text/json file, write, unlock
  def alter_text(filename, &blk)
    File.open(filename, 'r+') do |source|
      source.flock(File::LOCK_SH)
      text = source.read
      text = (blk.call(text) || text).to_s
      source.flock(File::LOCK_EX)
      source.truncate(0); source.rewind; source.write(text)
    end
  end
  
  def alter_json(filename, &blk)
    require 'json'
    alter_text(filename) do |text|
      object = JSON.parse(text)
      blk.call(object)
      JSON.generate(object)
    end
  end
  
  def flock_read(filename)
    File.open(filename, 'r') do |file|
      file.flock File::LOCK_SH
      file.read
    end
  end
  
#   # invent a new unique room folder, to create a room with!
#   def new_room_folder(title)
#     folder = digitless_folder = 'room/' + title.gsub(/[^A-Za-z0-9]+/, '-').sub(/^(-?)(.+?)(-?)$/, '\2')
#     digit = 1
#     folder = "#{digitless_folder}-#{digit}" and digit += 1 while File.exist?(folder)
#     folder
#   end
  
  # return a login screen if user needs to auth to use controller, usage: "require_login or return"
  def require_login
    @cookies.delete('once_logged_in')
    return true if @state.identity
    @cookies.once_logged_in = URL(@env.PATH_INFO).to_s
    @error = 'You need to login to view this page'
    @body = render(:login)
    return false
  end
  
  # add a message to a room
  def send_message(room, message)
    require 'json'
    meta = {'timestamp' => Time.now.to_i}
    msgid = nil
    
    File.open("rooms/#{room}/message-counter", 'r+') do |counter|
      counter.flock File::LOCK_EX # exclusive lock, make everyone else wait till we're done
      msgid = counter.read.to_i + 1
      
      File.open("rooms/#{room}/temp-#{msgid}", 'w') do |msg|
        msg.write(JSON.generate(meta.merge(message)))
      end
      File.rename("rooms/#{room}/temp-#{msgid}", "rooms/#{room}/message-#{msgid}")
      
      counter.truncate(0); counter.rewind; counter.write(msgid.to_s)
    end
    
    return msgid
  end
end
