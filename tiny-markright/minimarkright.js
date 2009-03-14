var MiniMarkright = new Class({
  formats: {'*': {tag: 'strong'}, '_': {tag: 'em'}, '/': {tag: 'em', 'class': 'italic'}, '\\': {tag: 'em', 'class': 'oblique'}},
  
  initialize: function() {
    this.sensor = new RegExp($H(this.formats).getKeys().map(function(item) {
      return '(' + item.escapeRegExp() + '(.+?)' + item.escapeRegExp() + ')';
    }).join('|'), 'g');
  },
  
  apply: function(element) {
    $A(element.childNodes).each(function(node) {
      if (node.nodeType == Node.ELEMENT_NODE && node.tagName.toUpperCase() != 'A') {
        Array.each(node.childNodes, this.apply);
        return;
      }
      
      var result;
      this.sensor.lastIndex = 0;
      while (result = this.sensor.exec(node.data)) {
        this.sensor.lastIndex = 0;
        
        var newNode = node.splitText(result.index);
        node = newNode.splitText(result[0].length);
        newNode.parentNode.replaceChild(this.builder(result, newNode), newNode);
      }
    }.bind(this));
  },
  
  builder: function(result, oldnode) {
    var opts = this.formats[oldnode.data.substring(0, 1)];
    var el = new Element(opts.tag);
    el.set(opts);
    el.set('text', oldnode.data.substring(1, oldnode.data.length - 1));
    this.apply(el.firstChild);
    return el;
  }
});

/*
apply: function(element, sensor, builder) {
  var self = this;
  $A(element.childNodes).each(function(node) {
    if (node.nodeType != Node.TEXT_NODE) return;
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
  
applyToElement: function(element) {
  var self = this;
  $A(element.childNodes).each(function(node) {
    switch (node.nodeType) {
    case Node.TEXT_NODE:
      self.applyToTextNode(node);
      break;
    case Node.ELEMENT_NODE:
      if (node.tagName.toLowerCase() == 'a') break;
      self.applyToElement(node);
      break;
    }  
  });
}
*/
      
window.addEvent('load', function() {
  var minim = new MiniMarkright();
  
  $('testcases').getChildren().each(function(div) {
    minim.apply(div.firstChild);
  });
});