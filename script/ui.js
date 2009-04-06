// A simple collection of element builder functions for various bits of UI inside of talkie, for dynamically building windows.
var UI = {
  // makes a container (looks like a window), be sure to .getFirst() the resulting element to get the body to stick stuff in
  container: function(type, opts) {
    type = type || 'regular';
    var cont = new Element('div', Hash.combine({'class': type + 'Container container'}, opts || {}));
    var body = new Element('div', {'class': type + 'Body body'});
    var foot = new Element('div', {'class': 'footer'});
    cont.adopt(body); cont.adopt(foot);
    recenter.delay(50);
    return cont;
  },
    
  // Usage: UI.bar(), or optionally UI.bar('top'), or 'bottom' depending on where it is in the window. :)
  bar: function(end) {
    return (new Element('div', {'class': 'bar' + (end ? ' '+end : '')}));
  },
  
  // Usage: something.adopt(UI.button('thing', 'left', {href: '/somewhere'}));
  button: function(text, type, options) {
    var btn = new Element('a', options || {});
    btn.addClass('button');
    btn.addClass(type || 'square');
    if (text) btn.set('text', text);
    (new Element('em')).inject(btn, 'top');
    return btn;
  },
  
  // for use in the bar's for nicely rendered fancy font text titles
  title: function(text) {
    var div = new Element('div', {'class': 'title'});
    var subdiv = new Element('div', {'class': 'text', 'text': text});
    div.adopt(subdiv);
    if (Cufon) UI.finishTasks.push(function() { Cufon.replace(subdiv); });
    return div;
  },
  
  // for use inside a bar for positioning, make sure to set the 'type' for buttons so they hang over correctly too :)
  centered: function() { return (new Element('div', {'class': 'centered'})); },
  lefted: function() { return (new Element('div', {'class': 'lefted'})); },
  righted: function() { return (new Element('div', {'class': 'righted'})); },
  
  // stuff for the content of a window below the bar
  rule: function() { return (new Element('div', {'class': 'rule', 'html': '<hr/>'})); },
  
  // makes a sidebar container to put sidebarBoxy's inside of, like in the default chat client
  sidebar: function() { return (new Element('div', {'class': 'sidebar'})); },
  
  // be sure to .getElement('.body') the resulting element to get the body to stick things in.
  sidebarBoxy: function(opts) {
    var boxy = new Element('div', Hash.combine({'class': 'boxy'}, opts || {}));
    boxy.adopt(new Element('img', {'src': window.urlroot + "/style/sidebar-rect-top.png", 'class': 'ender top'}));
    boxy.adopt(new Element('div', {'class': 'body'}));
    boxy.adopt(new Element('img', {'src': window.urlroot + "/style/sidebar-rect-bottom.png", 'class': 'ender bottom'}));
    return boxy;
  },
  
  // a scrollable box.. add's a scrollbar basically
  scrolly: function(short) {
    var scroll = new Element('div', {'class': 'scroll'});
    if (short) scroll.addClass('shortScroll');
    return scroll;
  },
  
  // should be called after any block of usage of UI to do any stuff that has to happen after things enter the dom
  finish: function() {
    UI.finishTasks.each(function(func) { func.run(); });
    UI.finishTasks = [];
  },
  
  finishTasks: []
}