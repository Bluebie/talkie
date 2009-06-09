#Dir.chdir(File.dirname(__FILE__))
if ENV['RAILS_ENV'] == 'production'  # don't bother on dev
  ENV['GEM_PATH'] = '/home/bluebiepony/.gems' #+ ':/usr/lib/ruby/gems/1.8'  # Need this or Passenger fails to start
  #require '/home/bluebiepony/.gems/gems/RedCloth-4.1.9/lib/redcloth.rb'  # Need this for EACH LOCAL gem you want to use, otherwise it uses the ones in /usr/lib
end
require 'ui'

file_handler = Rack::File.new('.')

apps = Array.new

# redirect www. requests
apps << lambda do |env|
  request = Rack::Request.new(env)
  url = URI.parse(request.url)
  if url.host.match(/^www\./)
    url.host = url.host.sub(/^www\./, '')
    [301, {'Location' => url.to_s}, ['']]
  else
    [404, {}, ['']]
  end
end


apps << lambda do |env|
  begin
    mtime = File.mtime(env['PATH_INFO'].sub(/\//, ''))
    if !env['HTTP_IF_MODIFIED_SINCE'] || mtime > Time.rfc2822(env['HTTP_IF_MODIFIED_SINCE'])
      r = file_handler.call(env)
      r[1]['Expires'] = (Time.now + 60*60*24).httpdate if env['PATH_INFO'] =~ /(script|style|default|users|rooms|sounds|\.png|\.jpeg)/
      r
    else
      [304, {'Last-Modified' => mtime.httpdate}, ['']]
    end
  rescue
    return [404, {}, ['']]
  end
end

apps << Rack::Builder.new do
  use Rack::ShowExceptions
  
  map "/stream" do
    require 'stream.rb'
    run Stream
  end
  
  map "/check-pulse" do
    run(lambda { |env| [200, {'Content-Type'=>'text/plain', 'Content-Length'=>'6'}, ['ponies']] })
  end
  
  map "/script/compiled" do
    use Rack::ContentLength
    use Rack::Deflater
    run(lambda { |env|
      files = [
        'mootools-1.2.1-core-yc.js',
        'mootools-1.2.1-more-rc01-multi-more.js',
        'cufon-yui.js',
        'Complete_in_Him_400.font.js',
        'ui.js',
        'network.js',
        'core.js'
      ]
      
      
      time = files.map { |f| File.mtime("script/#{f}") }.max
      if !env['HTTP_IF_MODIFIED_SINCE'] || time > Time.rfc2822(env['HTTP_IF_MODIFIED_SINCE'])
        data = files.map { |f| File.read("script/#{f}") }.join("\n")
        [200, {
          'Content-Type'=> 'application/javascript',
          'Last-Modified'=> time.httpdate
        }, [data]]
      else
        [304, {}, ['']]
      end
    })
  end
  
  map "/" do
    run(lambda { |env|
      response = UserInterface.call(env)
      response[1]['Content-Length'] = response[2].body.to_s.length.to_s
      response
    })
  end
end

run Rack::ShowExceptions.new(Rack::Cascade.new(apps))

if __FILE__ == $0
  Rack::Handler::CGI.run Rack::ShowExceptions.new(UserInterface)
end
