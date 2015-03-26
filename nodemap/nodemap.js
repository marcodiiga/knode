(function ($) {
  'use strict';

  // ---------- Node class and methods ----------
  Node = function ($map, $parent, nodeName, href) {

    this.$map     = $map;
    this.name     = nodeName;
    this.href     = href;
    this.$parent  = $parent;
    this.children = []; // No children for us for now

    // Create the node element in the page and append it to the map's object
    this.element = $('<a href="' + this.href + '">' + this.name + '</a>')
      .addClass('node');
    this.$map.prepend (this.element);

    // The node will be moved directly from code
    this.element.css ('position', 'absolute');

    if (this.$parent == null) // Check if I'm the root
      this.element.addClass('root');
    else {
      this.$parent.node.children.push (this); // Add me as a child of my parent
      console.log("TODO line");//TODO if children add a line from me to parent to mapObject
    }

    // TODO activate draggable jquery ui

    //TODO click stuff
  }

  // ---------- Map class and methods ----------

  // Generate a node map on the jQuery selected objects
  $.fn.createNodeMap = function (options) {
    var initialSize = -1;
    options = $.extend({ // Add default options for our map to use
      mapArea: {
        width:  initialSize,
        height: initialSize
      }
    }, options);

    var $window = $(window);

    return this.each(function () { // Generate a node map (returns this)
        // Set up a drawing area
        if (options.mapArea.width === initialSize)
          options.mapArea.width = $window.width();
        if (options.mapArea.height === initialSize)
          options.mapArea.height = $window.height();

        // Add a canvas to the selector of this element
        $(this).append( Raphael (0, 0, options.mapArea.width,
                                       options.mapArea.height) );

        // Add a class to the map DOM object to let node styles be applied
        $(this).addClass ('nodemap');
      });
  };

  $.fn.createNodes = function () { // Create the nodes of the map recursively
    var $rootli = $('>ul>li', this);
    // Create the root node
    var $rootNode = $('>a', $rootli).addNode (this, null);
    var $map = this; // Save 'this' (selector map) for the closure
    // Foreach sub-anchor item of the root li item -> add a node
    $('>ul>li>a', $rootli).each (function() {
      $(this).addNode ($map, $rootNode);
    });
  };


/*
  $.fn.addRootNode = function () {
    var node = new Node (null,                // No parent (root)
                         this.text(),         // nodeName
                         this.attr('href'));  // href
    this.node = node;
    return this;
  };
  */


  $.fn.addNode = function (map, parent) {
    var node = new Node (map,                 // map selector (to add <a>s)
                         parent,              // parent <a> selector
                         this.text(),         // nodeName
                         this.attr('href'));  // href
    this.node = node;
    return this;
  };

} (jQuery));
