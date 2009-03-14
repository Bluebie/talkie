var idpProviders = [
  {'Yahoo': 'http://www.yahoo.com/',                  'type': 'directedID'},
  {'Google': 'https://www.google.com/accounts/o8/id', 'type': 'directedID'},
  
  {'AOL': 'http://openid.aol.com/{username}',                'type': 'usernameID'},
  {'Livejournal': 'http://{username}.livejournal.com/',      'type': 'usernameID'},
  {'Wordpress.com': 'http://wordpress.com/',                 'type': 'directedID'},
  {'Flickr': 'http://flickr.com/photos/{username}/',         'type': 'usernameID'},
  {'Technorati': 'http://technorati.com/people/technorati/{username}', 'type': 'usernameID'},
  {'Vox': 'http://{username}.vox.com/',                      'type': 'usernameID'},
  {'Blogger': 'http://{username}.blogspot.com/',             'type': 'usernameID'},
  
  /* some good IDP's */
  {'MyOpenID.com': 'http://myopenid.com/', 'type': 'directedID'},

  
  {'Any OpenID': '{openid}', 'type': 'IDURL'}
];

window.addEvent('load', function() {
  // set up the idp selector
  var selector = $('idp');
  idpProviders.each(function(provider) {
    var provider = $H(provider);
    var type = provider.type;
    provider.erase('type');
    var name = provider.getKeys()[0];
    var url = provider.getValues()[0];
    
    var option = new Element('option', {value: url, text: name});
    option.store('idp-type', type);
    selector.adopt(option);
    
    if (url == Cookie.read('idp-template')) selector.selectedIndex = selector.getChildren().length - 1;
  });
  
  // when user chooses
  selector.addEvent('change', function() {
    var option = selector.getChildren()[selector.selectedIndex];
    var type = option.retrieve('idp-type');
    
    $$('#loginForm .extra').setStyle('display', 'none');
    $(type).setStyle('display', '');
    
    var inputs = $$('#' + type + ' input');
    if (inputs.length > 0) inputs[0].focus();
  });
  
  selector.fireEvent('change');
  $('openid').set('value', Cookie.read('idp-openid'));
  $('username').set('value', Cookie.read('idp-username'));
  
  
  // handle the continue button
  $('login').addEvent('click', function() {
    var option = selector.getChildren()[selector.selectedIndex];
    var type = option.retrieve('idp-type');
    var openid = option.value;
    
    openid = openid.substitute({ 'openid': $('openid').value, 'username': $('username').value });
    
    Cookie.write('idp-template', option.value, {duration: 360});
    Cookie.write('idp-openid', $('openid').value, {duration: 360});
    Cookie.write('idp-username', $('username').value, {duration: 360});
    
    window.location.href = '/openid?identity=' + encodeURIComponent(openid);
  });
  
  window.addEvent('keypress', function(event) {
    if (event.key == 'enter') $('login').fireEvent('click');
  });
  
/*
  var loginError = Cookie.read('login_error');
  if (!loginError) $('loginError').setStyle('display', 'none');
  if (loginError)  $('loginError').set('text', loginError.replace(/\+/g, ' '));
  Cookie.dispose('login_error');
*/
});

