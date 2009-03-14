#!ruby

lines = `ps aux |grep "thin"`
lines.each do |line|
  user, pid, stuff = line.split(/ +/)
  `kill -9 #{pid}` if user == 'bluebie'
end