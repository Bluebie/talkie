var Game = {
  // Constants
  grassCount: 2, // number of available grass tiles
  spriteWidth: 44, //px
  spriteHeight: 22, //px
  displayAreaWidth: 15, // shouldn't change unless window size changes
  displayAreaHeight: 36, // shouldn't change unless window size changes
  gameAreaWidth: 11, // tiles - note that horizontal doesn't include the half up/down row in count
  gameAreaHeight: 22, // tiles
  spriteGrid: new Array(),
  players: [window.openid],
  currentPlayer: window.openid,
  
  getPatch: function(x, y) {
    //if (x.grass) { x = x.x; y = x.y; }
    if (!$defined(Game.spriteGrid[x]) || $type(Game.spriteGrid[x][y]) != 'object') return null;
    if ($defined(Game.spriteGrid[x][y].patch)) return Game.spriteGrid[x][y].patch;
    var patch =  new Patch(x, y);
    Game.spriteGrid[x][y].patch = patch;
    return patch;
  },
  
  mouse: {x: 0, y: 0, xf: 0.0, yf: 0.0},
  highlighted: null, // highlighted fence railing...
  
  validateMove: function(mouse) {
    var patch = Game.getPatch(mouse.x, mouse.y);
    if (!patch || !patch.railings) return false;
    
    var side = (mouse.xf - mouse.x > 0.5) ? 'right' : 'left';
    var railing = patch.railings[side];
    if (railing.get('data-solid')) return false;
    
    if (side == 'left'  && !$defined(patch.goSouthWest().pole)) return false;
    if (side == 'right' && !$defined(patch.goSouthEast().pole)) return false;
    return true;
  },
  
  isBoxFinished: function(patch) {
    //if (!patch) return false;
    var patches = [
      Game._isBoxFinished(patch),
      Game._isBoxFinished(patch.goNorthEast()),
      Game._isBoxFinished(patch.goNorthWest()),
      Game._isBoxFinished(patch.goNorth())
    ];
    return patches.filter(function(i) { return i != false });
  },
  
  _isBoxFinished: function(patch) {
    if (!patch || !patch.sheep || !patch.goSouthWest() || !patch.goSouthEast()) return false;
    if (
      patch.railings.left.get('data-solid') == 'yes' &&
      patch.railings.right.get('data-solid') == 'yes' &&
      patch.goSouthWest().railings.right.get('data-solid') == 'yes' &&
      patch.goSouthEast().railings.left.get('data-solid') == 'yes'
    ) {
      return patch;
    } else {
      return false;
    }
  },
  
  onMouseMove: function(event) {
    if (Game.currentPlayer != window.openid) return;
    var newMouse = $merge({}, Game.mouse);
    var rawMouse = {x: event.page.x - $(this).getPosition().x, y: event.page.y - $(this).getPosition().y};
    
    newMouse.yf  = Math.floor(rawMouse.y / (Game.spriteHeight / 2)) + 2;
    newMouse.y  = Math.floor(newMouse.yf);
    newMouse.xf = (rawMouse.x / Game.spriteWidth) + 0.5;
    if ((newMouse.y % 2) == 1) newMouse.xf -= 0.5;
    newMouse.x  = Math.floor(newMouse.xf);
    
    if (Game.highlighted && (Game.mouse.xf != newMouse.xf || Game.mouse.y != newMouse.y)) {
      Game.highlighted.fade('hide');
      Game.highlighted = null;
    }
    
    if (Game.validateMove(newMouse)) {
      Game.highlighted = Game.getPatch(newMouse.x, newMouse.y).railings[newMouse.xf - newMouse.x > 0.5 ? 'right' : 'left'];
      Game.highlighted.fade('show');
      Game.mouse = newMouse;
    }
  },
  
  onMouseClick: function(event) {
    if (Game.currentPlayer != window.openid) return;
    if (!Game.highlighted) return;
    Game.highlighted = null;
    var rail = (Game.mouse.xf - Game.mouse.x > 0.5 ? 'right' : 'left');
    Game.playMove(Game.mouse.x, Game.mouse.y, rail);
    // TODO: post the move to the server
    
  },
  
  // plays a move, takes x, y, and 'left' or 'right indicating the railing to play from that point
  playMove: function(x, y, lr) {
    var patch = Game.getPatch(x, y);
    var railing = patch.railings[lr];
    railing.set('data-solid', 'yes');
    railing.get('tween').cancel();
    railing.fade('show');
    var patches = Game.isBoxFinished(Game.getPatch(Game.mouse.x, Game.mouse.y));
    if (patches.length > 0) patches.each(function (p) { p.finish(Game.currentPlayer); });
  }
};

var Patch = new Class({
  initialize: function(x, y) {
    this.x = x, this.y = y; this.boxOwner = null; // openid
    this.finished = false;
    this.oddness = (y % 2);
    Hash.extend(this, Game.spriteGrid[x][y]);
  },
  
  finish: function(openid) {
    this.finished = true;
    this.boxOwner = openid || null;
    this.sheep.fade('in');
  },
  
  goNorth: function() { return Game.getPatch(this.x, this.y - 2); },
  goSouth: function() { return Game.getPatch(this.x, this.y + 2); },
  goEast:  function() { return Game.getPatch(this.x + 1, this.y); },
  goWest:  function() { return Game.getPatch(this.x - 1, this.y); },
  
  goNorthEast: function() { return Game.getPatch(this.x + this.oddness,     this.y - 1); },
  goNorthWest: function() { return Game.getPatch(this.x - (1-this.oddness), this.y - 1); },
  goSouthEast: function() { return Game.getPatch(this.x + this.oddness,     this.y + 1); },
  goSouthWest: function() { return Game.getPatch(this.x - (1-this.oddness), this.y + 1); }
});


window.addEvent('domready', function() {
  
  //// set the title
  window.oldTitle = document.title = settings.title + ' — ' + document.title;
  
  //// Build the page
  document.body.adopt(container = UI.container('game'));
  body = container.getFirst();
  // the bar up top
  body.adopt(bar = UI.bar('top'));
  bar.adopt(centered = UI.centered());
  centered.adopt(UI.title(window.settings.title));
  bar.adopt(lefted = UI.lefted());
  lefted.adopt(UI.button('Leave', 'left', { href: 'leave', 'id': 'leave' }));
  if (settings.owners.contains(window.openid)) {
    bar.adopt(righted = UI.righted());
    righted.adopt(UI.button('Settings', 'square', { href: 'setup' }));
  }
  
  body.adopt(game_area = new Element('div', {'id': 'gamearea'}));
  game_area.addEvents({click: Game.onMouseClick, mousemove: Game.onMouseMove});
  
  UI.finish();
  
  // preload the graphics
  window.sprites = {};
  ['sheep', 'pole', 'grass-1', 'grass-2', 'left-railing', 'right-railing'].each(function(name) {
    body.adopt(sprites[name] = new Element('img', {'src': ui_root + name + '.png', 'class': name}));
  });
});


window.addEvent('load', function() {
  // create the sprite display
  var grass_count = Game.grassCount;
  var sprite_width = Game.spriteWidth;
  var sprite_height = Game.spriteHeight;
  var game_area = $('gamearea');
  var display_area_width = Game.displayAreaWidth;
  var display_area_height = Game.displayAreaHeight;
  var game_area_width = Game.gameAreaWidth;
  var game_area_height = Game.gameAreaHeight;
  
  game_area.setStyles({
    position: 'absolute',
    overflow: 'hidden',
    width: game_area.getParent().getSize().x + 'px',
    height: game_area.getParent().getSize().y - 28 + 'px'
  });
  
  var add_sprite = function(sprite, top, left, zindex) {
    var thing = sprite.clone();
    thing.setStyle('position', 'absolute');
    thing.setStyle('left', left - ((sprite.getStyle('width').toInt() - sprite_width) / 2));
    thing.setStyle('top', top - (sprite.getStyle('height').toInt() - sprite_height));
    thing.setStyle('z-index', zindex + 1000);
    thing.addClass('s' + left + 'x' + top);
    game_area.adopt(thing);
    return thing;
  }
  
  Game.displayAreaHeight.times(function(y) {
    Game.displayAreaWidth.times(function(x) {
      var odd_line = (y % 2) == 1;
      var left = (x * Game.spriteWidth) - (Game.spriteWidth / 2) + (odd_line ? (Game.spriteWidth / 2) : 0)
      var top = (y * (Game.spriteHeight / 2)) - Game.spriteHeight;
      var zindex = 5000 + (y * Game.gameAreaWidth * 100) + (x * 10);
      
      var grass = add_sprite(sprites['grass-' + $random(1, grass_count)], top, left, zindex);
      
      
      var v_gap = (Game.displayAreaHeight - Game.gameAreaHeight) / 2; // the padding to center playable area
      var h_gap = (Game.displayAreaWidth - Game.gameAreaWidth) / 2;
      if (y-1 >= Math.floor(v_gap) && y-1 < Math.floor(Game.displayAreaHeight - v_gap) && x >= Math.floor(h_gap) && x < Math.floor(Game.displayAreaWidth - h_gap)) {
        var pole = add_sprite(sprites['pole'], top, left, zindex + 1000);
        var lrail = add_sprite(sprites['left-railing'], top, left, zindex + 1001).fade('hide');
        var rrail = add_sprite(sprites['right-railing'], top, left, zindex + 1002).fade('hide');
        var sheep = add_sprite(sprites['sheep'], top, left, zindex + 1003).fade('hide');
      }
      
      // store it
      var thingob = {};
      thingob.grass = grass;
      if (pole) thingob.pole = pole;
      if (sheep) thingob.sheep = sheep;
      if (lrail && rrail) thingob.railings = {left: lrail, right: rrail};
      Game.spriteGrid[x] = Game.spriteGrid[x] || [];
      Game.spriteGrid[x][y] = thingob;
    });
  });
  
  Hash.getValues(sprites).each(Element.dispose); // remove the preloader sprites from the page
  
  //window.stream.start.delay(50, window.stream);
  Network.setup();
  Network.stream.addEvents({
    'application/x-paddocks-place-railing': function(message) {
      Game.playMove.run(message.body);
    }
  });
  
  // Begin the network connectivity
  Network.begin();
  
  window.addEvents({'beforeunload': Network.stream.stop.bind(Network.stream), 'unload': Network.stream.stop.bind(Network.stream)});
  $('leave').addEvent('click', Network.stream.stop.bind(Network.stream));
  
  
  // Setup the room background :)
  if (settings.background && settings.background.enabled) {
    var spacer = $(document.html);
    if (settings.background.url.toString().length > 0) spacer.setStyle('background-image', 'url("'+settings.background.url+'")');
    spacer.setStyle('background-color', settings.background.colour);
    spacer.setStyle('background-repeat', settings.background.repeat ? 'repeat' : 'no-repeat');
    spacer.setStyle('background-position', 'center center');
  }
});


focused = function() {
  document.title = window.oldTitle;
  window.unreadNum = 0;
  if (window.fluid) window.fluid.dockBadge = null;
  //$('message').focus();
};

$(document).addEvent('mousemove', focused);
$(document).addEvent('keydown', focused);
$(document).addEvent('focus', focused);
$(window).addEvent('mousemove', focused);
$(window).addEvent('keydown', focused);
$(window).addEvent('focus', focused);

