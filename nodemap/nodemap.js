(function ($) {
  'use strict';

  var MOVEMENT_TIMEOUT = 4;        // 4 seconds for the nodes' movement timeout
  var CHILD_PARENT_INIT_DISTANCE = 5; // Starting child<->parent distance

  // ---------- Node class and methods ----------
  Node = function ($map, $parent, nodeName, href) { // Typical scope: Node object

    this.$map       = $map;
    this.name       = nodeName;
    this.href       = href;
    this.$parent    = $parent; // null for root object, $('a') for the others
    this.children   = [];      // Our children will populate this for us
    this.moveTimer  = 0;       // Timer callback to move this node to equilibrium
    this.stopMoving = false;   // Whether this node should stop moving

    // Create the node element in the page and append it to the map's object
    this.$element = $('<a href="' + this.href + '">' + this.name + '</a>')
      .addClass('node');
    this.$map.prepend (this.$element);

    this.elementWidth  = this.$element[0].offsetWidth;  // Can be 0 during moving
    this.elementHeight = this.$element[0].offsetHeight; // Can be 0 during moving

    // Note: Adjusted positions are comprehensive of an element's width and height
    if ($parent != null) { // Position in the map area. By default the parent's
      this.x = $parent.node.x; // position is given..
      this.y = $parent.node.y;
    } else { // ..but if the node is the root it is put in the center
      this.x = ($map.options.mapArea.width / 2);
      this.y = ($map.options.mapArea.height / 2);
    }

    // The node will be moved directly from code into the map
    this.$element.css ('position', 'absolute');

    if (this.$parent == null) { // Check if I'm the root
      this.$element.addClass('root');
      this.$map.rootNode = this;
      // Immediately set the root element position to the center of the area
      this.position ();
    } else {
      this.$parent.node.children.push (this); // Add me as a child of my parent

      //TODO if children add a line from me to parent to mapObject
    }

    // TODO activate draggable jquery ui

    //TODO click stuff
  }

  // Position the node in the (x;y) position keeping into account the element's
  // width and height
  Node.prototype.position = function () {
    this.adjustedX = this.x - (this.elementWidth / 2);
    this.adjustedY = this.y - (this.elementHeight / 2);
    this.$element.css({'left': this.adjustedX + "px",
                       'top':  this.adjustedY + "px" });
  }

  // Calculate this node's equilibrium position relative to its father's
  Node.prototype.calculateEquilibriumPoint = function (index) {
    var stepAngle = Math.PI * 2 / this.$parent.node.children.length; // Radiants
    var angle = index * stepAngle;
    this.x = (CHILD_PARENT_INIT_DISTANCE * Math.cos(angle)) + this.$parent.node.x;
    this.y = (CHILD_PARENT_INIT_DISTANCE * Math.sin(angle)) + this.$parent.node.y;
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
    // the final coordinates in (x;y) and (adjustedX, adjustedY)
    $.each (this.children, function (index) {
      this.calculateEquilibriumPoint (index);
      //DEBUG TODO 1) disable this


      this.position ();



    });
    // TODO 2) set a timer with a callback to transition the current position
    // of the child nodes to the x;y destination one.

    this.animationLoop (); // Start the animation loop

    // TODO 3) Set a threshold to be reached and stop the callback when done
  }

  // This function will call itself repeatedly until all children nodes have
  // reached an equilibrium position
  Node.prototype.animationLoop = function () {
    var thisNode = this;

    // Move children nodes according to their calculated forces
    for (var i = 0; i < this.children.length; ++i) {
      var forceVector = this.children[i].calculateForceVector ();
      this.children[i].x += forceVector.dx * 2;
      this.children[i].y += forceVector.dy * 2;
      this.children[i].position ();
    }

    setTimeout(function () {
      thisNode.animationLoop();
    }, 10);
  }

  // Returns an object with dx and dy values representing a force vector for a
  // given node. The force vector is the result of the repulsive forces against
  // all the other nodes in the graph and attractive forces towards TODO
  Node.prototype.calculateForceVector = function () {
    var x, y, f, distance, theta, xsign, fx = 0, fy = 0;

    // Using Coulomb's Law, calculate the repulsive force from every other node
    for (var i = 0; i < this.$map.nodes.length; ++i) {
      if (this.$map.nodes[i] === this) // Repulsive force from myself = nonsense
        continue;
      /*
if (!this.$map.nodes[i].visible) // TODO: a visible attribute could be useful
        continue;*/

      // Calculate x and y distances between the nodes
      x = (this.$map.nodes[i].x - this.x);
      y = (this.$map.nodes[i].y - this.y);
      distance = Math.sqrt((x * x) + (y * y)); // Distance between nodes
      if (Math.abs(distance) < 400) { // Excessive distance means no force
        // Get the angle between x and y as if they were cos and sin
        if (x === 0) { // Prevent division by zero
          theta = Math.PI / 2;
          xsign = 1;
        } else {
          theta = Math.atan (y / x);
          xsign = x / Math.abs (x); // This sign is needed to correctly
                                    // orient the repulsive force components.
                                    // Only the X one is needed due to the atan
                                    // function graph
        }
        // Calculate force for the given distance and apply its components
        f = 400 / (distance * distance);
        fx += -f * Math.cos (theta) * xsign;
        fy += -f * Math.sin (theta) * xsign;
      }
    }
    return {dx: fx, dy: fy};
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
    this.nodes = []; // A list of all the nodes of the map (necessary later)

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
    $map.nodes[$map.nodes.length] = this.node; // Keep a list of all the nodes
                                               // for some distance calculations
    // Everytime a node is added its parent's subtree needs to be reshaped
    if ($parent != null)
      $parent.node.animateToStaticPosition (); // This node will drag its children

    return this;
  };

} (jQuery));
