Dir.chdir(File.dirname(__FILE__))
require 'ui'

file_handler = Rack::File.new('.')

apps = Array.new

apps << lambda do |env|
  begin
    if !env['HTTP_IF_MODIFIED_SINCE'] || File.mtime(env['PATH_INFO'].sub(/\//, '')) > Time.rfc2822(env['HTTP_IF_MODIFIED_SINCE'])
      r = file_handler.call(env)
      r[1]['Expires'] = (Time.now + 60*60*24).httpdate if env['PATH_INFO'] =~ /(script|style|default|users|rooms|sounds)/
      r[1]['X-Awesome-Concept'] = 'Telepathy'
      r
    else
      [304, {}, ['']]
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
    run(lambda { |env| [200, {'Content-Type'=>'text/plain', 'X-Awesome-Thing'=>'Radium Paint', 'Content-Length'=>'6'}, ['ponies']] })
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
          'X-Awesome-Pony'=> 'Bluebie',
          'Last-Modified'=> time.httpdate
        }, [data]]
      else
        [304, {'Content-Type' => 'application/javascript'}, ['']]
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

run Rack::Cascade.new(apps)

if __FILE__ == $0
  Rack::Handler::CGI.run Rack::ShowExceptions.new(UserInterface)
end
