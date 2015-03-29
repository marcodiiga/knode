(function ($) {
  'use strict';

  var MOVEMENT_TIMEOUT = 4; // 4 seconds for the nodes' movement timeout
  var CHILD_PARENT_INIT_DISTANCE = 30; // Starting child<->parent distance
  var NODES_REPULSIVE_FACTOR = 300;
  var LINES_RESTORING_FACTOR = 3000;

  // ---------- Node and Line class and methods ----------

  var Node = function ($map, $parent, nodeName, href) { // Typical scope: Node object

    this.$map         = $map;
    this.name         = nodeName;
    this.href         = href;
    this.$parent      = $parent; // null for root object, $('a') for the others
    this.children     = [];      // Our children will populate this for us
    this.hasPosition  = false;   // Has this node been assigned an initial position?
    this.moveTimer    = 0;       // Timer callback to move this node to equilibrium
    this.dx = this.dy = 0;     // Force vector (tells this node where to go)

    // Create the node element in the page and append it to the map's object
    this.$element = $('<a href="' + this.href + '"><p>' + this.name + '</p></a>')
      .addClass('node');
    this.$map.prepend (this.$element);

    this.elementWidth  = this.$element[0].offsetWidth;  // Can be 0 during moving
    this.elementHeight = this.$element[0].offsetHeight; // Can be 0 during moving

    // Note: Adjusted positions are comprehensive of an element's width and height
    if ($parent != null) { // Position in the map area. By default the parent's
      this.x = $parent.node.x; // position is given (this will have to be)
      this.y = $parent.node.y; // recalculated..
    } else { // ..but if the node is the root it is put in the center..
      this.x = ($map.options.mapArea.width / 2);
      this.y = ($map.options.mapArea.height / 2);
      this.hasPosition = true; // ..and no additional calculations are needed
    }

    // The node will be moved directly from code into the map
    this.$element.css ('position', 'absolute');

    if (this.$parent == null) { // Check if I'm the root
      this.$element.addClass('root');
      this.$map.rootNode = this;
      // Immediately set the root element position to the center of the area
      this.takePosition ();
    } else {
      this.$parent.node.children.push (this); // Add me as a child of my parent
      // Add a line from this node to my parent
      $map.lines[$map.lines.length] = new Line ($map, this, this.$parent.node);
    }

    var thisNode = this;
    this.$element.draggable ({ // Set a jQuery callback function when dragging
      drag: function () {
        thisNode.animateToStaticPosition ();
      }
    });

    //TODO click stuff
  }


  // Returns 'true' if I reached stability (i.e. an equilibrium point where
  // all the forces are below a threshold), otherwise return 'false'
  Node.prototype.stabilityReached = function () {

    // To determine if I reached stability I need to calculate my resulting
    // force vector and compare it against some minimum thresholds
    var forceVector = this.calculateForceVector ();
    // Save the resulting vector components (these will move our position)
    this.dx = forceVector.dx * 10;
    this.dy = forceVector.dy * 10;

    // Set to zero insignificant forces
    if (Math.abs(this.dx) < this.$map.options.minimumForceThreshold)
      this.dx = 0;
    if (Math.abs(this.dy) < this.$map.options.minimumForceThreshold)
      this.dy = 0;
    if (Math.abs(this.dx) + Math.abs(this.dy) === 0) { // If both are insignificant
      this.dx = this.dy = 0;
      console.log("Node " + this.name + " has reached equilibrium");
      return true; // Yes, I've reached equilibrium
    }

    return false; // State that I haven't reached stability yet
  }

  // Position a node in the (x;y) coordinates by taking into account the element's
  // dimensions and the force components that are asking to move it (dx;dy)
  Node.prototype.takePosition = function () {

    if (this.dx !== 0) // Apply dx and dy components if present
      this.x += this.dx * 10;
    if (this.dy !== 0)
      this.y += this.dy * 10;

    this.adjustedX = this.x - (this.elementWidth / 2);
    this.adjustedY = this.y - (this.elementHeight / 2);
    this.$element.css({'left': this.adjustedX + "px",  // Finally position me
                       'top':  this.adjustedY + "px" });
  }

  // Lay off radially this node around its father's position
  Node.prototype.layNodeAroundParent = function (index) {
    var stepAngle = Math.PI * 2 / this.$parent.node.children.length; // Radiants
    var angle = index * stepAngle;
    this.x = (CHILD_PARENT_INIT_DISTANCE * Math.cos(angle)) + this.$parent.node.x;
    this.y = (CHILD_PARENT_INIT_DISTANCE * Math.sin(angle)) + this.$parent.node.y;
  }

  // Sets the wheels in motion for all the children of a specific node in order
  // for them to reach a final static equilibrium position
  //
  // This function has two goals:
  //  1) Calculate the initial equilibrium position for each node of the graph
  //     (children are as close to their parents as specified by the variable
  //     CHILD_PARENT_INIT_DISTANCE)
  //  2) Start an animation loop which computes force vectors per each node and
  //     apply them to simulate movement
  Node.prototype.animateToStaticPosition = function() {
    // Position of this local root node will be recalculated, stop moving


    // clearTimeout (this.animationLoop);

    // Recalculate my children's equilibrium points. Each child will have
    // the final coordinates in (x;y) and (adjustedX, adjustedY)
    //$.each (this.children, function (index) {
    //  this.calculateEquilibriumPoint (index);
    //  this.position ();
    //});


    this.animationLoop (); // Start the animation loop

  }

  // Returns 'true' if the entire subtree (i.e. me and my child nodes)
  // have reached equilibrium positions
  Node.prototype.subtreeSeekEquilibrium = function () {
    var stabilityReached = true; // Assume my subtree has reached stability

    // If my children haven't been positioned yet, lay them around me
    $.each(this.children, function (index) {
        if (this.hasPosition == false) {
          this.layNodeAroundParent (index);
          this.takePosition ();
          this.hasPosition = true;
        }
    });

    // There's no point in asking if I'm stable if I'm being dragged.
    // If this element is being dragged by jQuery UI, just store its position
    if (this.$element.hasClass ("ui-draggable-dragging")) {
      this.x = parseInt (this.$element.css('left'), 10) +
        (this.$element.width() / 2); // Adjust the bottom-right dragging pos
      this.y = parseInt (this.$element.css('top'), 10) +
        (this.$element.height() / 2);
      stabilityReached = false; // I'm surely not stable yet
    } else { // If I'm not being dragged, I might be already stable
      stabilityReached = this.stabilityReached() && stabilityReached; // Am I stable?
      if (stabilityReached == false) // If I haven't reached stability, at least
        this.takePosition (); // get me closer to achieve it
    }

    // Do the same for every other children: seek stability recursively
    for (var i = 0; i < this.children.length; ++i) {
      stabilityReached = this.children[i].subtreeSeekEquilibrium() && stabilityReached;
    }
    return stabilityReached;
  }

  // This function will call itself repeatedly until all children nodes have
  // reached an equilibrium position
  Node.prototype.animationLoop = function () {



    if (this.subtreeSeekEquilibrium ()) {
      return; // Avoid the callback and just return if our subtree got equilibrium
    }







    var thisNode = this;
    setTimeout(function () {
      thisNode.animationLoop();
    }, 10);
  }

  // Using Coulomb's Law, calculate a repulsion force from another node
  Node.prototype.calculateSingleRepulsionForceFromNode = function (otherNode) {
    var x, y, f, distance, theta, xsign, dx = 0, dy = 0;
    // Calculate x and y distance components between the nodes
    x = (otherNode.x - this.x);
    y = (otherNode.y - this.y);
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
      f = NODES_REPULSIVE_FACTOR / (distance * distance);
      dx = -f * Math.cos (theta) * xsign;
      dy = -f * Math.sin (theta) * xsign;
    }
    return { dx: dx,
             dy: dy };
  }

  // Using Hooke's Law, calculate an attractive force towards another node
  Node.prototype.calculateSingleAttractiveForceTowardsNode = function (otherNode) {
    var x, y, f, distance, theta, xsign, dx = 0, dy = 0;
    // Calculate x and y distance components between the nodes
    x = (otherNode.x - this.x);
    y = (otherNode.y - this.y);
    distance = Math.sqrt((x * x) + (y * y)); // Distance between nodes
    if (Math.abs(distance) > 0) { // If we're on the same spot, no force
      // Get the angle between x and y as if they were cos and sin
      if (x === 0) { // Prevent division by zero, see comments above
        theta = Math.PI / 2;
        xsign = 1;
      } else {
        theta = Math.atan (y / x); // See comments above
        xsign = x / Math.abs (x);
      }
      // Calculate Hooke's force and apply its components
      f = (15 * distance * 0.03) / LINES_RESTORING_FACTOR;
      dx = f * Math.cos (theta) * xsign;
      dy = f * Math.sin (theta) * xsign;
    }
    return { dx: dx,
             dy: dy };
  }

  // Returns an object with dx and dy values representing a force vector for a
  // given node. The force vector is the result of the repulsive forces against
  // all the other nodes in the graph and attractive forces towards the nodes
  // connected to this with a line. There's also an additional force: if this
  // node is the selected one (isTheSelectedNode is true), it will have a force
  // that pushes it towards the center of the map
  Node.prototype.calculateForceVector = function () {
    var i, otherEnd, f, fx = 0, fy = 0;

    // Calculate the repulsive force from every other node on my same level
    // (i.e. the children of my parent node). If I have a parent, obviously..
    if (this.$parent !== null) {
      var mySiblingNodes = this.$parent.node.children;
      for (i = 0; i < mySiblingNodes.length; ++i) {
        if (mySiblingNodes[i] === this)
          continue; // Repulsive force from myself = nonsense
        //
  //if (!this.$map.nodes[i].visible) // TODO: a visible attribute could be useful
      //    continue;

        f = this.calculateSingleRepulsionForceFromNode (mySiblingNodes[i]);
        fx += f.dx;
        fy += f.dy;
      }
      // And also the repulsive force from my parent node
      f = this.calculateSingleRepulsionForceFromNode (this.$parent.node);
      fx += f.dx;
      fy += f.dy;
    }



    // Using Hooke's Law, add an attractive force per each line I'm a part of
    // (only if they're not my children)
    for (i = 0; i < this.$map.lines.length; ++i) {
      otherEnd = null; // The other end of the line I'm attached to (if any)
      if (this.$map.lines[i].startNode === this)
        otherEnd = this.$map.lines[i].endNode;
      else if (this.$map.lines[i].endNode === this)
        otherEnd = this.$map.lines[i].startNode;
      else
        continue; // I'm not a part of this line, keep on searching

      if (this.children.indexOf(otherEnd) !== -1)
        continue; // This is one of my children, keep on searching

      // TODO: ignore hidden nodes' pulling (visible)

      f = this.calculateSingleAttractiveForceTowardsNode (otherEnd);
      fx += f.dx;
      fy += f.dy;
    }


    // If I'm the selected node, push me towards the center of the map (Hooke)
    if (this.$map.selectedNode === this) {
      f = this.calculateSingleAttractiveForceTowardsNode ({
        x: (this.$map.options.mapArea.width / 2),
        y: (this.$map.options.mapArea.height / 2),
        centerOfTheMap: true
      });
      fx += f.dx;
      fy += f.dy;
    }

    return {dx: fx, dy: fy};
  }


  // A Line object is a connection between two nodes of the map
  var Line = function ($map, startNode, endNode) {
    this.$map = $map;
    this.startNode = startNode;
    this.endNode = endNode;
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
      minimumForceThreshold : 0.002,
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
    this.lines = []; // A list of all the connections in the map
    this.selectedNode = null; // The centered, selected node

    // Add a canvas to the selector of this element and save it as a property
    var canvas = Raphael (0, 0, options.mapArea.width,
                                options.mapArea.height);
    this.append (canvas);
    this.canvas = canvas;

    // Add a class to the map DOM object to let node styles be applied
    this.addClass ('nodemap');

    return this;
  }

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
  }


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
                          this.attr('href'));     // href
    $map.nodes[$map.nodes.length] = this.node; // Keep a list of all the nodes
                                               // for some distance calculations
    // Everytime a node is added its parent's subtree needs to be reshaped
    if ($parent != null) {
      // Every other sibling of this node will have to be re-positioned around
      // the parent for the first time the children are laid out
      $.each ($parent.node.children, function () {
        this.hasPosition = false;
      });
      $parent.node.animateToStaticPosition (); // This node will drag its children
    } else
      $map.selectedNode = this.node; // TODO: implement a selection mechanism, for now
                                     // the root is the selected element

    return this;
  }

} (jQuery));
