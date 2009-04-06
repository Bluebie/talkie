function menuify(menu) {
  menu.setStyle('visibility', 'hidden');
  
  var hide = function () { menu.setStyle('visibility', 'hidden'); menu.fireEvent('menuhidden'); }
  var show = function () { menu.setStyle('visibility', 'visible'); menu.fireEvent('menushown'); }
  
  var closer;
  menu.getParent().addEvents({
    click: function() {
      if (menu.getStyle('visibility') == 'hidden') show();
      else hide();
    },
    mouseleave: function() {
      closer = (function () { hide(); }).delay(2000);
    },
    mouseenter: function() { $clear(closer); }
  });
}

window.addEvent('domready', function () {
  // add's a class so we can do browser specific css really easy :)
  $(document.body).addClass(Browser.Engine.name);
  
  // makes menu's work
  $$('.menu').each(menuify);
  
  // if smilies are available, set up a parser
  if (window.smiliesData) {
    window.smilies = new SmiliesParser(window.smiliesData);
  }
  
});

// set a pie to a certain fraction 0.0-1.0 in range for progress indicators :)
function setPie(pie, fraction) {
  var picture = (Math.floor(fraction * 20)).toInt() * 30;
  $(pie).getFirst().setStyle('margin-left', (0 - picture) + 'px');
}


/*
Script: Class.Binds.js
	Automatically binds specified methods in a class to the instance of the class.

License:
	http://www.clientcide.com/wiki/cnet-libraries#license
*/
(function(){
	var binder = function(self, binds){
		var oldInit = self.initialize;
		self.initialize = function() {
			Array.flatten(binds).each(function(binder) {
				var original = this[binder];
				this[binder] = function(){
					return original.apply(this, arguments);
				}.bind(this);
				this[binder].parent = original.parent;
			}, this);
			return oldInit.apply(this,arguments);
		};
		return self;
	};
	Class.Mutators.Binds = function(self, binds) {
		if (!self.Binds) return self;
		delete self.Binds;
		return binder(self, binds);
	};
	Class.Mutators.binds = function(self, binds) {
		if (!self.binds) return self;
		delete self['binds'];
		return binder(self, binds);
	};
})();


// nifty doohicky for relative fuzzy time
Number.prototype.within = function(min, max) {
  if (this >= min && this <= max) return true;
  return false;
}

Date.prototype.relativeTime = function(to) {
  if (!to) to = new Date();
  var minutes = ((to.getTime() - this.getTime()).abs() / 60000).round();
  if (minutes == 0)                        return 'less than a minute';
  else if (minutes.within(0,1))            return 'about a minute';
  else if (minutes.within(2,44))           return minutes + ' minutes';
  else if (minutes.within(45,89))          return 'about 1 hour';
  else if (minutes.within(90,1439))        return 'about ' + (minutes / 60).round() + ' hours';
  else if (minutes.within(1440,2879))      return '1 day';
  else if (minutes.within(2880,43199))     return 'about ' + (minutes / 1440).round() + ' days';
  else if (minutes.within(43200,86399))    return 'about a month';
  else if (minutes.within(86400,525599))   return 'about ' + (minutes / 43200).round() + ' months';
  else if (minutes.within(525600,1051199)) return 'about a year';
  else return 'over ' + (minutes / 525600).round() + ' years';
}


// simple class to process a set of smilies in to the related graphics :)
var SmiliesParser = new Class({
  initialize: function(smiledata) {
    this.data = smiledata;
    this.sensor = new RegExp($H(smiledata).getValues().map(function(item) {
      return item.map(function(i) {
        return '(' + i.escapeRegExp() + ')';
      }).join('|');
    }).join('|'), 'g');
  },
  
  applyToTextNode: function(startNode) {
    var smiles = []; var self = this;
    var result; var node = startNode;
    
    this.sensor.lastIndex = 0;
    while (result = this.sensor.exec(node.data)) {
      this.sensor.lastIndex = 0;
      
      var newNode = node.splitText(result.index);
      node = newNode.splitText(result[0].length);
      smiles.push(newNode);
    }
    
    smiles.each(function(smile) {
      var src;
      
      
      Hash.getKeys(self.data).each(function(smileImg) {
        if (self.data[smileImg].contains(smile.data)) src = smileImg;
      });
      
      var img = new Element('img', {alt: smile.data, title: smile.data, src: src, 'class':'smiley'});
      smile.parentNode.replaceChild(img, smile);
    });
    
  },
  
  applyToElement: function(element) {
    var self = this;
    $A(element.childNodes).each(function(node) {
      switch (node.nodeType) {
      case 3: // = Node.TEXT_NODE
        self.applyToTextNode(node);
        break;
      case 1: // = Node.ELEMENT_NODE
        if (node.tagName.toLowerCase() == 'a') break;
        self.applyToElement(node);
        break;
      }  
    });
  }
});

// simple singleton object to automatically turn url's in to <a> elements :)
var AutoLink = {
  //weblinksSensor: /(http|gopher|irc|ftp|telnet|ssh)s?\:\/\/.+( )/
  weblinkSensor: /[a-zA-Z]+:\/\/([.]?[a-zA-Z0-9_\/?:@=&%-])*/,
  domainlinkSensor: /(^| )(www([.]?[a-zA-Z0-9_\/-])*)/,
  
  apply: function(element, sensor, builder) {
    var self = this;
    $A(element.childNodes).each(function(node) {
      if (node.nodeType != 3) return; // 3 = Node.TEXT_NODE except IE doesn't define 'Node', bleh.
      var result;
      sensor.lastIndex = 0;
      while (result = sensor.exec(node.data)) {
        sensor.lastIndex = 0;
        
        var newNode = node.splitText(result.index);
        node = newNode.splitText(result[0].length);
        newNode.parentNode.replaceChild(builder(result, newNode), newNode);
      }
    });
  },
  
  smallishText: function(text, len) {
    if (!len) len = 70;
    if (text.length < len) return text;
    return text.substring(0, len - 1) + '…';
  },
  
  urls: function(element) {
    AutoLink.apply(element, AutoLink.weblinkSensor, function(match, node) {
      return new Element('a', {href: match[0], text: AutoLink.smallishText(match[0]), title: match[0], target: '_blank'});
    });
  },
  
  domains: function(element) {
    AutoLink.apply(element, AutoLink.domainlinkSensor, function(match, node) {
      return new Element('a', {href: 'http://' + match[2] + '/', text: match[0], target: '_blank'});
    });
  },
  
  everything: function(element) {
    AutoLink.domains(element);
    AutoLink.urls(element);
  }
};


var Users = {
  profiles: {}, active: [],
  
  lookup: function(openid) {
    return (Users.profiles[openid] || {name: 'Unknown User', desc: 'No Description', hasAvatar: false, userDir: '../../default/user', updated: 0});
  },
  
  loadProfile: function(userinfo) {
    if (Users.profiles[userinfo.identity] != userinfo) {
      Users.profiles[userinfo.identity] = userinfo;
      
      $$('#messages .' + userinfo.userDir.replace(/\//g, '')).each(function(span) {
        Users.generateHTML(userinfo.identity).replaces(span);
      });
    }
  },
  
  me: function() { return lookup(window.openid); },
  
  refreshList: function() {
    var userlist = $$('#userlist .body')[0];
    userlist.empty();
    
    Users.active.each(function(openid) {
      var info = Users.lookup(openid);
      var user = Users.generateHTML(openid);
      user.set('title', 'OpenID: ' + openid);
      userlist.adopt(user);
    });
  },
  
  generateHTML: function(openid) {
    var userinfo = Users.lookup(openid);
    var el = new Element('span', {'class': 'user'});
    el.store('openid', openid);
    
    var favatar = new Element('img', {'class': 'favatar', src: '/style/sidebar-favicon-rounding.png'});
    if (userinfo.hasAvatar) favatar.setStyle('background-image', 'url("' + userinfo.userDir + '/avatar-16.png?' + userinfo.updated + '")');
    el.adopt(favatar);
    
    el.adopt(new Element('span', {text: userinfo.name}));
    el.addClass(userinfo.userDir.replace(/\//g, ''));
    return el;
  }
}


function uploadWindow(kind, params, complete) {
  var container = UI.container('halfHeight');
  $(document.body).adopt(container);
  var body = container.getFirst();
  body.adopt(UI.bar('top').adopt(UI.centered().adopt(UI.title('Avatar Upload')), UI.lefted().adopt(UI.button('Close', 'left', {events: { click: function() { container.destroy(); }}}))));
  
  var iframe = new Element('iframe', {width: '640', height: '221', frameborder: '0'});
  body.adopt(iframe);
  var doc = iframe.contentWindow.document;
  doc.open();
  doc.write("<!doctype html>\n");
  doc.write("<html><head></head><body></body></html>");
  doc.close();
  
  var els
  $(doc.body).adopt(
    (new Element('form', {method: 'post', enctype: 'multipart/form-data', action: '/alter-avatar/' + kind + '/upload'})).adopt(
      els = (new Element('div')).adopt(
        new Element('input', {'type': 'file', name: 'upload'}),
        new Element('input', {'type': 'submit', value: 'Send Picture'})
      )
    )
  );
  
  Hash.each(params, function(val, key) {
    els.adopt(new Element('input', {'type': 'hidden', name: key, value: val}));
  });
  
  (function() {
    iframe.addEvent('load', function() {
      if (complete) complete(doc);
      container.destroy();
    });
  }).delay(100);
  
  UI.finish();
}



// keep the thingy centered
function recenter() {
  var sides = {'x': 'left', 'y': 'top'};
  $$('.container').each(function(container) {
    Hash.each(sides, function(edge, dim) {
      if (window.getSize()[dim] <= container.getSize()[dim] + (dim == 'y' ? container.getLast().getSize()[dim] : 3)) {
        container.setStyle(edge, '0'); container.setStyle('margin-' + edge, '0');
      } else {
        container.setStyle(edge, ''); container.setStyle('margin-' + edge, '');
      }
    });
  });
}

if (Browser.Platform != 'ipod') {
  window.addEvents({load: recenter, resize: recenter});
}

