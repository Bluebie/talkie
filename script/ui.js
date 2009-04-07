// A simple collection of element builder functions for various bits of UI inside of talkie, for dynamically building windows.
var UI = {
  // makes a container (looks like a window), be sure to .getFirst() the resulting element to get the body to stick stuff in
  container: function(type, opts, contains) {
    type = type || 'regular';
    var cont = new Element('div', Hash.combine({'class': type + 'Container container'}, opts || {}));
    var body = new Element('div', {'class': type + 'Body body'});
    var foot = new Element('div', {'class': 'footer'});
    cont.adopt(body); cont.adopt(foot);
    if (contains) body.adopt.run(contains, body);
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
    if (text) ($type(text) == 'string' ? btn.set('text', text) : btn.adopt(text));
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
  sidebarBoxy: function(opts, contains) {
    var boxy = new Element('div', Hash.combine({'class': 'boxy'}, opts || {}));
    boxy.adopt(new Element('img', {'src': window.urlroot + "/style/sidebar-rect-top.png", 'class': 'ender top'}));
    var body = new Element('div', {'class': 'body'});
    if (contains) body.adopt.run(contains, body);
    boxy.adopt(body);
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

// creates a model upload window
function uploadWindow(kind, params, complete) {
  if (kind == 'user' || kind == 'room') var kind = window.urlroot + '/alter-avatar/' + kind + '/upload';
  var container = UI.container('halfHeight');
  $(document.body).adopt(container);
  var body = container.getFirst();
  body.adopt(UI.bar('top').adopt(UI.centered().adopt(UI.title('Avatar Upload')), UI.lefted().adopt(UI.button('Close', 'left', {events: { click: function() { container.destroy(); }}}))));
  
  UI.finish();
  
  var iframe = new Element('iframe', {width: '640', height: '221', frameborder: '0'});
  body.adopt(iframe);
  var doc = iframe.contentWindow.document;
  doc.open();
  doc.write("<!doctype html>\n");
  doc.write("<html class=\"frame\"><head></head><body></body></html>");
  doc.close();
  
  var els
  $(doc.body.previousSibling).adopt($('styles').clone(true));
  $(doc.body).adopt(
    new Element('p', {text: "To upload a file, choose it using the file selector here and press Send File. You only need to press that button once, and after the upload is completed, this window will close itself. You can upload any of the following formats: " + params.formats + " and no larger than " + (params.maxSize / 1000000).toInt() + " megabytes."}),
    (new Element('form', {id: 'formy', method: 'post', enctype: 'multipart/form-data', action: kind})).adopt(
      els = (new Element('div')).adopt(
        new Element('input', {'type': 'file', name: 'upload', maxlength: params.maxSize}),
        UI.button('Send File', 'square', {onclick: 'this.parentNode.parentNode.submit();'})
      )
    )
  );
  
  Hash.erase(params, 'maxSize');
  Hash.erase(params, 'formats');
  Hash.each(params, function(val, key) {
    els.adopt(new Element('input', {'type': 'hidden', name: key, value: val}));
  });
  
  (function() {
    iframe.addEvent('load', function() {
      if (complete && complete(iframe.contentWindow.document) === false) return;
      container.destroy();
    });
  }).delay(100);
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