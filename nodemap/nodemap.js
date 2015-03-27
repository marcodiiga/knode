(function ($) {
  'use strict';

  var MOVEMENT_TIMEOUT = 4;        // 4 seconds for the nodes' movement timeout
  var CHILDREN_NODES_RADIUS = 170; // Children nodes' distance from parent

  // ---------- Node class and methods ----------
  Node = function ($map, $parent, nodeName, href) { // Typical scope: Node object

    this.$map       = $map;
    this.name       = nodeName;
    this.href       = href;
    this.$parent    = $parent; // null for root object, $('a') for the others
    this.children   = [];      // Our children will populate this for us
    this.moveTimer  = 0;       // Timer callback to move this node to equilibrium
    this.stopMoving = false;   // Whether this node should stop moving

    if ($parent != null) { // Position in the map area. By default the parent's
      this.x = $parent.node.x; // position is given..
      this.y = $parent.node.y;
    } else { // ..but if the node is root
      this.x = ($map.options.mapArea.width / 2); // is put to the center
      this.y = ($map.options.mapArea.height / 2);
    }

    // Create the node element in the page and append it to the map's object
    this.element = $('<a href="' + this.href + '">' + this.name + '</a>')
      .addClass('node');
    this.$map.prepend (this.element);

    // The node will be moved directly from code
    this.element.css ('position', 'absolute');

    if (this.$parent == null) { // Check if I'm the root
      this.element.addClass('root');
      this.$map.rootNode = this;
      // Immediately set the root element position to the center of the area
      $(this.element).css({'left': this.x + "px",
                           'top':  this.y + "px" });
    } else {
      this.$parent.node.children.push (this); // Add me as a child of my parent

      //TODO if children add a line from me to parent to mapObject
    }

    // TODO activate draggable jquery ui

    //TODO click stuff
  }

  // Calculate this node's equilibrium position relative to its father's
  Node.prototype.calculateEquilibriumPoint = function (index) {
    var stepAngle = Math.PI * 2 / this.$parent.node.children.length; // Radiants
    var angle = index * stepAngle;
    this.x = (CHILDREN_NODES_RADIUS * Math.cos(angle)) + this.$parent.node.x;
    this.y = (CHILDREN_NODES_RADIUS * Math.sin(angle)) + this.$parent.node.y;
  };

  // Starts from a node and recursively sets its and its children's
  // positions over time to a static position
  Node.prototype.animateToStaticPosition = function() {
    // Position of this local root node will be recalculated, stop moving
    /*
clearTimeout ($node.node.moveTimer);

    $node.node.moveTimer = setTimeout (function () {
      $node.node.stopMoving = true; // Stop moving for this node
    }, MOVEMENT_TIMEOUT * 1000);*/

    // Recalculate my children's equilibrium points. Each child will have
    // the final coordinates in (x;y)
    $.each (this.children, function (index) {
      this.calculateEquilibriumPoint (index);
      //DEBUG TODO 1) disable this
      $(this.element).css({'left': this.x + "px",
                                'top': this.y + "px" });
    });
    // TODO 2) set a timer with a callback to transition the current position
    // of the child nodes to the x;y destination one.
    // TODO 3) Set a threshold to be reached and stop the callback when done
  }

  // ---------- Map class and methods ----------

  // Generate a node map on the jQuery selected object
  // Notice: the selector should contain a single instance
  $.fn.createNodeMap = function (options) { // Typical scope: $('body') object

    if (this.length != 1) { // Sanity check for single instance
      $.error ("Single selector instance expected, multiple instances found");
      return;
    }

    var initialSize = -1;
    options = $.extend({ // Add default options for our map to use
      mapArea: {
        width:  initialSize,
        height: initialSize
      }
    }, options);

    // Set up a drawing area
    if (options.mapArea.width === initialSize)
      options.mapArea.width = $(window).width();
    if (options.mapArea.height === initialSize)
      options.mapArea.height = $(window).height();

    this.options = options; // Save it for the $map

    // Add a canvas to the selector of this element and save it as a property
    var canvas = Raphael (0, 0, options.mapArea.width,
                                options.mapArea.height);
    this.append (canvas);
    this.canvas = canvas;

    // Add a class to the map DOM object to let node styles be applied
    this.addClass ('nodemap');

    return this;
  };

  // Create the nodes of the map recursively
  $.fn.createNodes = function () { // Typical scope: $('body') object
    var $map = this; // Save 'this' (the map selector) for any closure
    var $rootli = $('>ul>li', this);
    // Create the root node
    var $rootNode = $('>a', $rootli).addNode ($map, null);
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


  $.fn.addNode = function ($map, $parent) { // Typical scope: $('a') object
    this.node = new Node ($map,      // map to add <a>s, typically $('body')
                          $parent,         // parent <a> selector
                          this.text(),        // nodeName
                          this.attr('href'));   // href
    // Everytime a node is added its parent's subtree needs to be reshaped
    if ($parent != null)
      $parent.node.animateToStaticPosition (); // This node will drag its children

    return this;
  };

} (jQuery));
