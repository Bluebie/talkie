#!/usr/bin/ruby
require 'json'
require 'helpers'
require 'fileutils'
include UserInterface::Helpers

StreamRuntime = 50
InitialLogSize = 30


Stream = lambda do |env|
  
  req = Rack::Request.new(env)
  response = Rack::Response.new()
  room = req.params["room"].gsub(/[^a-z0-9-]/, '')
  settings = JSON.parse(flock_read("rooms/#{room}/settings"))
  msgid = 1; users_infoed = [];
  next_file = proc { "rooms/#{room}/message-#{msgid}" }
  outbox = Array.new
  
  # handle cross domain xhr requests safely, allows us to work around the connection limit in browsers
#   from = URI.parse(env['HTTP_ORIGIN'].strip) if env['HTTP_ORIGIN']
#   us   = URI.parse(req.url)
#   if env['HTTP_ORIGIN'] && us.host[-(from.host.length) .. -1].downcase == from.host.downcase
#     response['Access-Control-Allow-Origin'] = env['HTTP_ORIGIN']
#   end
  
  raise 'unknown identity, account not valid' unless File.exist?("users/#{userhash(req['identity'])}")
  
  send_user_info = lambda do |hash, id|
    hash ||= userhash(id)
    unless users_infoed.include?(hash)
      userdir(id) if id unless File.exist?("users/#{hash}")
      userinfo = JSON.parse(flock_read("users/#{hash}/profile"))
      userinfo['identity'] = id || flock_read("users/#{hash}/openid")
      userinfo['hasAvatar'] = File.exist?("users/#{hash}/avatar-16.png")
      userinfo['userDir'] = "/users/#{hash}"
      userinfo['updated'] = File.mtime("users/#{hash}/profile").to_i
      outbox << '{"data":{"type":"application/x-talkie-user-info","body":[' + JSON.generate(userinfo) + ']}}'
      users_infoed << hash
    end
  end
  
  send_active_users = lambda do
    user_infos = Dir.entries("rooms/#{room}/active-members").reject { |h| h.include?('.') }.map { |h|
      send_user_info[h, false]
      IO.read("users/#{h}/openid")
    }
    
    if settings['bot'] and settings['bot']['enabled']
      send_user_info[nil, settings['bot']['url']]
      user_infos.push(settings['bot']['url'])
    end
    outbox << '{"data":{"type":"application/x-talkie-active-users","body":' + JSON.generate(user_infos) + '}}'
  end
  
  
  # timeout old users
  timeout = (StreamRuntime.to_f * 2.5).to_i
  cutoff = Time.now - timeout
  Dir.entries("rooms/#{room}/active-members").each do |hash|
    next if hash.include?('.')
    last_beat = File.mtime("rooms/#{room}/active-members/#{hash}")
    if last_beat < cutoff
      send_message(room, 'type' => 'application/x-talkie-user-leaves', 'from' => IO.read("users/#{hash}/openid"), 'body' => 'left.', 'timestamp' => last_beat.to_i + timeout)
      File.delete("rooms/#{room}/active-members/#{hash}")
    end
  end
  
  
  # store our own heartbeat
  send_message(room, 'type' => 'application/x-talkie-user-enters', 'from' => req.params['identity'], 'body' => 'entered.') unless File.exist?("rooms/#{room}/active-members/#{userhash(req['identity'])}")
  FileUtils.touch("rooms/#{room}/active-members/#{userhash(req['identity'])}")
  
  # determine which message to go looking for
  current = flock_read("rooms/#{room}/message-counter").to_i
  msgid = (req['last'] || current - InitialLogSize).to_i
  msgid = 1 if msgid < 1
  msgid += 1 while !File.exist?(next_file[]) && msgid < current
  msgid += 1
  
  
  # stall for up to ~25 seconds if there's no new data to reduce http requests
  monies = StreamRuntime * 3
  while (monies > 0)
    
    if File.exist?(next_file[])
      while File.exist?(next_file[])
        object = JSON.parse(data = IO.read(next_file[]))
        #if object['from'] && (!req['last'] || File.mtime(userdir(object['from'])) > File.mtime(next_file[]))
          send_user_info[nil, object['from']] if object['from']
        #end
        
        outbox << '{"id":' + msgid.to_s + ',"data":' + data + "}"
        msgid += 1
      end
      
      # send the active users list if it's the initial request
      send_active_users[] unless req['last']
      monies = 0 unless outbox.empty?
    end
    
    monies = 0 if req['poll'] == 'instant'
    
    monies -= 1
    sleep 1.0 / 3.0 if monies > 0
  end
  
  response['Content-Type'] = 'text/plain'
  response['Expires'] = 'Thu, 1 Jan 1995 00:00:00 GMT'
  response['Cache-Control'] = 'max-age=0, no-cache, no-store, private'
  
  # handle various output modes...
  mode = req['mode'] || 'lines'
  case mode
  when 'lines'
    response['Content-Type'] = 'text/plain'
    outbox.each { |part| response.write("#{part}\n") }
  when 'array'
    response['Content-Type'] = req['callback'] ? 'application/javascript' : 'application/json'
    response.write(req['callback'] + '(') if req['callback']
    response.write "[\n"
    outbox.each_index do |i|
      response.write('  ' + outbox[i])
      response.write(",\n") unless i == outbox.length - 1
    end
    response.write "\n]"
    response.write ');' if req['callback']
  else
    response['Content-Type'] = 'text/plain'
    response.write 'Unknown Mode'
  end
  
  response.finish
end



