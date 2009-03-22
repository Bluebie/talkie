#!/usr/bin/ruby
require 'rubygems'
require 'camping'
require 'camping/session'
gem 'ruby-openid'
require 'openid'
require 'openid/extensions/sreg'
require 'openid/extensions/ax'
require 'json'

# make ssl not whiney
require 'openssl'
module OpenSSL; module SSL; remove_const :VERIFY_PEER; end; end
OpenSSL::SSL::VERIFY_PEER = OpenSSL::SSL::VERIFY_NONE

# Temp Room Cleaner
require 'timeout'
TempRoomCleaner = Thread.new do
  while true
    Thread.stop
    Timeout.timeout(10) do
      cutoff = Time.now - 60*60*24
      Dir.foreach("rooms") do |room|
        next unless room.match(/^--/)
        next unless File.mtime("rooms/#{room}") < cutoff
        FileUtils.rm_rf("rooms/#{room}")
      end
    end
  end
end

AppName = 'Talkie'

Camping.goes :UserInterface

module UserInterface
  include Camping::Session
  def secure_blob_hasher(data)
    OpenSSL::HMAC.hexdigest(DIGEST, state_secret, data.to_s)
  end
end

require 'helpers'

class CurlError < Exception; end
CurlErrorMeanings = {
  '3' => 'Malformed URL',
  '6' => 'Couldn\'t resolve host',
  '7' => 'Failed to connect',
  '22' => 'Error receiving response, likely server error',
  '28' => 'Timed Out, script running too slow or server unresponsive',
  '47' => 'Response was redirect, did not follow, gave up'
}

BotNotifier = Thread.new do
  include UserInterface::Helpers
  Thread.current[:queue] = Queue.new
  Thread.current[:from] ||= 'http://example.org/'
  begin
    room = Thread.current[:queue].pop
    next unless File.exist?("rooms/#{room}")
    current_msg = flock_read("rooms/#{room}/message-counter").to_i
    last_msg    = flock_read("rooms/#{room}/bot-last-message").to_i
    settings    = JSON.parse(flock_read("rooms/#{room}/settings"))
    errors_left = flock_read("rooms/#{room}/bot-error-allowance").to_i
    next unless settings['bot']['enabled']
    #next if errors_left == 0
    next if last_msg >= current_msg
    
    begin
      url = URI.parse(settings['bot']['url'])
      raise :stuff unless url.scheme.downcase == 'http'
    rescue
      raise "Bot URL '#{settings['bot']['url']}' is not valid"
    end
    
    response  = Tempfile.new('bot-response-', "rooms/#{room}")
    headers   = Tempfile.new('bot-headers-', "rooms/#{room}")
    error_log = Tempfile.new('bot-curl-errors-', "rooms/#{room}")
    
    messages = Array.new
    ((last_msg + 1)..current_msg).each do |id|
      if File.exist?("rooms/#{room}/message-#{id}")
        message = JSON.parse(File.read("rooms/#{room}/message-#{id}"))
        unless message['from'] == url.to_s or message['type'] == 'text/x-debug'
          message.merge!('id' => id)
          message['from'] = JSON.parse(flock_read("#{userdir(message['from'])}/profile")).merge('identifier' => message['from'])
          messages.push(message)
        end
      end
    end
    
    raise CurlError.new("Curl Request Failed, error: #{CurlErrorMeanings[$?.to_s] || $?}") unless system('curl',
      '--user-agent', 'Talkie Bot Runner',
      '--connect-timeout', '3',
      '--data-binary', JSON.generate(messages),
      '--header', 'Content-Type: application/json',
      '--header', 'Accept: application/json',
      '--max-time', '8',
      '--max-redirs', '0',
      '--stderr', error_log.path,
      '--dump-header', headers.path,
      '--output', response.path,
      url.to_s
    )
    
    
    returned_messages = JSON.parse(response.read) if response.size
    header_list = headers.read.split(/\r\n/).map { |i| i.split(/\:/, 2).map { |i| i.strip } }.map { |i| (i.length == 1) ? nil : i }.compact!
    header_list.flatten!
    header_list = Hash[*header_list]
    response.close!; error_log.close!; headers.close!
    
    bot_dir = userdir(url.to_s)
    FileUtils.touch("#{bot_dir}/bot")
    
    alter_json("#{bot_dir}/profile") do |o|
      if o['name'] != header_list['X-Talkie-Name']
        o['name'] = header_list['X-Talkie-Name']
      end
    end if header_list.has_key?('X-Talkie-Name')
    
    returned_messages = [returned_messages] if returned_messages.is_a?(Hash)
    raise 'Returned object is not an array' unless returned_messages.is_a?(Array)
    raise 'Returned more than 50 messages, aborting' if returned_messages.length > 50
    if returned_messages.length > 0
      returned_messages.each do |msg|
        raise "Returned message: #{JSON.generate(msg)} is not an object" unless msg.is_a?(Hash)
        raise 'Returned an illegal message type' if msg['type'] =~ /application\/x\-talkie/i
        raise 'Returned message over 5kb big, gave up' if msg['body'].to_s.length > 5_120
        send_message(room,
          :from => url.to_s,
          :type => msg['type'] || 'text/plain',
          :body => msg['body'] || ''
        )
      end
    end
    
    alter_text("rooms/#{room}/bot-last-message") { |o| current_msg }
    alter_text("rooms/#{room}/bot-error-allowance") { |o| o.to_i + 1 }
  rescue Object => e
    message = "Bot Error: #{e}"
    alter_text("rooms/#{room}/bot-error-allowance") do |text|
      if e.is_a?(CurlError)
        message += "\n#{error_log.read}"
        text = text.to_i - 5
        error_log.close!
      else
        message += "\n#{e.backtrace.join("\n")}"
        text = text.to_i - 10
      end
      text
    end
    
    send_message(room, :type => 'text/x-debug', :from => Thread.current[:from], :body => message)
  end until false
end

BotNotifier.abort_on_exception = true

require 'controllers'
require 'views'

