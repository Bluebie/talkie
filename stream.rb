#!/usr/bin/ruby
require 'json'
require 'helpers'
require 'fileutils'

StreamRuntime = 50
InitialLogSize = 30

class StreamController
  include UserInterface::Helpers
  
  def call(env)
    req = Rack::Request.new(env)
    response = Hash.new #Rack::Response.new()
    
    # create an array of rooms to watch
    rooms = req['rooms'].split(/,/).map { |r| r.gsub(/[^a-z0-9-]/, '') }
    # turn this in to a hash with room info for keys
    positions = Hash[*rooms.zip((req['positions'] || '').split(/,/)).flatten]
    rooms = Hash[*rooms.zip(rooms.map { |room|
      {
        :settings => JSON.parse(flock_read("rooms/#{room}/settings")),
        :position => (positions[room] == 'null') ? nil : positions[room].to_i,
        :raw_position => positions[room],
        :name => room
      }
    }).flatten]
    
    
    # timeout old users
    rooms.keys.each do |room|
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
    end
    
    # if the client is representing a user, do relevent stuff.
    if req['identity']
      raise 'unknown identity, account not valid' unless File.exist?("users/#{userhash(req['identity'])}")
      
      # store our own heartbeat
      hash = userhash(req['identity'])
      rooms.keys.each do |room|
        send_message(room, 'type' => 'application/x-talkie-user-enters', 'from' => req.params['identity'], 'body' => 'entered.') unless File.exist?("rooms/#{room}/active-members/#{hash}")
        FileUtils.touch "rooms/#{room}/active-members/#{hash}"
        FileUtils.touch "rooms/#{room}/active-members"
      end
    end
    
    # determine which message to go looking for
    rooms.each do |name, room|
      current = flock_read("rooms/#{room[:name]}/message-counter").to_i
      room[:position] = (room[:position] || current - InitialLogSize).to_i
      room[:position] = 1 if room[:position] < 1
      room[:position] += 1 while !File.exist?("rooms/#{room[:name]}/message-#{room[:position]}") && room[:position] < current
      room[:position] += 1
    end
    
    response['Content-Type']  = 'text/plain'
    response['Expires']       = 'Thu, 1 Jan 1995 00:00:00 GMT'
    response['Cache-Control'] = 'max-age=0, no-cache, no-store, private'
    
    # set the right mimetype and return, letting the server call the each method to get the body stream
    response['Content-Type'] = case req['mode'] || 'lines'
    when 'lines'
      'text/plain'
    when 'array'
      if req['callback']
        'application/javascript'
      elsif req['windowname']
        'text/html'
      else
        'application/json'
      end
    else
      'text/plain'
    end
    
    # this is buggy for some reason, so we'll do it the old fashioned way...
    #return [200, response, StreamThinger.new(req, rooms)]
    # so we'll do it like this instead, thin doesn't seem to like streaming, or something
    # P.S. I hate thin. Mongrel works great. Thin is edge trash <_<
    body = String.new
    StreamThinger.new(req, rooms).each { |str| body << str.to_s }
    response['Content-Length'] = body.length.to_s # might as well since we're doing this anyways...
    response['X-Awesome-Dinosaur'] = 'Iguanodon'
    return [200, response, [body]]
  end
  
  
  # this thing streams out messages to the client, the each method is called by the rack interface
  # when an instance of this is returned by the call method, providing a proc which the each method
  # is free to use to send out chunks of data to the client
  class StreamThinger
    include UserInterface::Helpers
    
    def initialize(req, rooms)
      @req = req
      @rooms = rooms
      @sent_anything = false
      @users_infoed = []
    end
    
    def send(text)
      return if text.to_s.empty?
      text = JSON.utf8_to_json(text.to_s) if @req['windowname']
      if @mode == 'array'
        @sendblk.call(',') if @sent_anything
        @sendblk.call(text.to_s)
      elsif @mode == 'lines'
        @sendblk.call("#{text}\n")
      end
      @sent_anything = true
    end
    
    def send_user(room, hash, id = nil)
      hash ||= userhash(id)
      unless @users_infoed.include?(hash)
        userdir(id) if id unless File.exist?("users/#{hash}")
        userinfo = JSON.parse(flock_read("users/#{hash}/profile"))
        userinfo['identity'] = id || flock_read("users/#{hash}/openid")
        userinfo['hasAvatar'] = File.exist?("users/#{hash}/avatar-16.png")
        userinfo['userDir'] = "/users/#{hash}"
        userinfo['updated'] = File.mtime("users/#{hash}/profile").to_i
        
        state_data = flock_read("rooms/#{room}/active-members/#{hash}") rescue '{}'
        state_data = '{}' if state_data.to_s.empty?
        userinfo['state'] = JSON.parse(state_data)
        
        @users_infoed << hash
        send '{"type":"application/x-talkie-user-info","body":[' + JSON.generate(userinfo) + ']}'
      end
    end
    
    def send_active_users(room)
      user_infos = Dir.entries("rooms/#{room[:name]}/active-members").reject { |h| h.include?('.') }.map { |hash|
        send_user(room, hash)
        IO.read("users/#{hash}/openid")
      }
      
      if room[:settings]['bot'] and room[:settings]['bot']['enabled']
        send_user(nil, room[:settings]['bot']['url'])
        user_infos.push(room[:settings]['bot']['url'])
      end
      send '{"type":"application/x-talkie-active-users","body":' + JSON.generate(user_infos) + ',"room":"' + room[:name] + '"}'
    end
    
    def send_global_state(room)
      data = flock_read("rooms/#{room[:name]}/state").to_s rescue '{}'
      data = '{}' if data.empty?
      send '{"type":"application/x-talkie-room-state","body":' + data + ',"room":"' + room[:name] + '"}'
    end
    
    
    
    def each(&blk)
      @sendblk = blk
      @mode = 'array' and blk["#{@req['callback']}("] if @req['callback']
      @mode = 'array' and blk["<!DOCTYPE html>\n<html><head><script>\nwindow.name='"] if @req['windowname']
      @mode = @req['mode'] || @mode || 'lines'
      blk["["] if @mode == 'array'
      
      # stream will run for approximately StreamRuntime seconds, and then abort
      monies = StreamRuntime * 3
      while (monies > 0)
        
        # check each subscribed room
        @rooms.values.each do |room|
          if File.exist?("rooms/#{room[:name]}/message-#{room[:position]}")
            while File.exist?("rooms/#{room[:name]}/message-#{room[:position]}")
              message = JSON.parse(File.read("rooms/#{room[:name]}/message-#{room[:position]}"))
              message.merge! 'id' => room[:position], 'room' => room[:name]
              
              # TODO: Only do this when user profile has changed since the user last received 
              if message['from'] && (!room[:raw_position] || room[:raw_position] == 'null' || File.mtime("users/#{userhash(message['from'])}/profile").to_i >= message['timestamp'] || message['type'] == 'application/x-talkie-user-enters')
                send_user(nil, nil, message['from']) if message['from']
              end
              
              send JSON.generate(message)
              room[:position] += 1
            end
          end
        end
        
        monies = 0 if @req['poll'] == 'long' && @sent_anything == true
        monies = 0 if @req['poll'] == 'instant'
        
        monies -= 1
        sleep 1.0 / 3.0 if monies > 0 # / <- to fix syntax highlighting regexp bug in Espresso
      end
      
      @rooms.values.each do |room|
        if !room[:raw_position] || room[:raw_position] == 'null'
          send_active_users(room)
          send_global_state(room)
        end
      end
      
      blk["]"] if @mode == 'array'
      blk["';\n</script></head></html>"] if @req['windowname']
      blk[');'] if @req['callback']
    end
  end
end

Stream = StreamController.new



