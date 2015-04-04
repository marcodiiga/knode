// Copyright (c) 2015, Alesiani Marco
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without modification,
// are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this
// list of conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice,
// this list of conditions and the following disclaimer in the documentation and/or
// other materials provided with the distribution.
//
// 3. Neither the name of the copyright holder nor the names of its contributors
// may be used to endorse or promote products derived from this software without
// specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
// IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
// INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
// BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
// LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
// OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
// OF THE POSSIBILITY OF SUCH DAMAGE.

(function ($) {
  'use strict';

  var MOVEMENT_TIMEOUT = 5; // 5 seconds for the nodes' movement timeout
  var CHILD_PARENT_INIT_DISTANCE = 50; // Starting child<->parent distance
  var NODES_REPULSIVE_FACTOR = 460;
  var LINES_RESTORING_FACTOR = 8000;

  // ---------- Node and Line class and methods ----------

  // Typical scope: Node object
  var Node = function ($map, $parent, nodeName, nodeId, href, depthLevel) {

    this.$map         = $map;
    this.name         = nodeName;
    this.id           = nodeId || 0; // The id might be undefined
    this.href         = href;
    this.$parent      = $parent; // null for root object, $('a') for the others
    this.children     = [];      // Our children will populate this for us
    this.hasPosition  = false;   // Has this node been assigned an initial position?
    this.dx = this.dy = 0;       // Force vector (tells this node where to go)
    this.isStable     = false; // True if this node is currently considered stable
    this.depthLevel   = depthLevel; // The depth level of this node (used when
                                    // adjusting forces to render deep children
                                    // closer to their parents)
    this.stabilityTimeout = 0;      // A timeout for the subtree stability search
    this.stopSubtreeMoving = false; // The variable that controls the timeout
    this.beginDragging = false;     // Since jquery messes around with a node's
                                    // position when dragging starts, if this is
                                    // true, we don't consider this node at all

    // Create the node element in the page and append it to the map's object
    this.$element = $('<a href="' + this.href + '"><p>' + this.name + '</p></a>')
      .addClass('node');
    this.$element.node = this; // The <a> element stores a reference to us and
                               // we also store a reference to the <a> element
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
      start: function(event, ui) {
        thisNode.beginDragging = true; // Avoid jquery problems with scale and drag
        ui.position.left = 0;
        ui.position.top = 0;
      },
      drag: function (event, ui) {

        // This code is necessary to have the node dragging working if any
        // container that contains this map has been scaled - see (*)
        var leftChange = ui.position.left - ui.originalPosition.left;
        var topChange = ui.position.top - ui.originalPosition.top;
        // Scale the changes by the 'scale' factor
        var newLeft = ui.originalPosition.left
          + leftChange / thisNode.$map.options.scale;
        var newTop = ui.originalPosition.top
          + topChange / thisNode.$map.options.scale;
        // Apply the scaled changes (these are correct)
        ui.position.left = newLeft;
        ui.position.top = newTop;

        // When a node is being dragged, all its children and siblings are also
        // unstable because its position will modify their position as well
        if (thisNode.$parent == null) // Animate my subtree only if I'm the root
          thisNode.animateToStaticPosition ();
        else // If I'm not the root, animate my parent's subtree (where I belong)
          thisNode.$parent.node.animateToStaticPosition ();

        thisNode.beginDragging = false; // From now on, consider this node's
                                        // position when moving the others
      }
    });

    //TODO click stuff
  }

  // Add a child node to the 'this' parent node. 'id' can be null if no id is
  // needed to reference the node later
  Node.prototype.addChildNode = function (id, href, name) {
    // Create a new node element as my child and an incremented depth level
    this.$map.addNode (this.$map, this.$element, this.depthLevel+1, id, href, name);
  }

  // Delete this node from the map. If called on the root will delete all the
  // entire graph. Child nodes aren't preserved.
  Node.prototype.deleteNode = function () {
    var thisNode = this; // For the various closures

    if (this.$map.rootNode === this) { // Destroy all the graph
      $.each (this.$map.nodes, function () {
        this.$element.remove ();
      });
      this.$map.nodes = [];
      this.$map.lines = [];
      this.canvas.clear ();
      return;
    }
    // Delete the node from my parent and from the map
    this.$parent.node.children = $.grep (this.$parent.node.children, function (node) {
      return node !== thisNode; // Return all the nodes which aren't this one
    });
    this.$map.nodes = $.grep (this.$map.nodes, function (node) {
      return node !== thisNode;
    });
    // And also delete the connectors referring to this node
    this.$map.lines = $.grep (this.$map.lines, function (line) {
      if (line.startNode === thisNode || line.endNode === thisNode)
        return false;
      else
        return true;
    });
    // Finally delete the <a> element
    this.$element.remove ();

    // All my sibling nodes have now to be re-positioned
    markNodesAsNeedingPositionRecursively (this.$parent.node.children);
    this.$parent.node.animateToStaticPosition (); // Start animate the parent's subtree
  }

  // Mark this node as selected for the entire map. This causes the selected
  // node to be positioned at the center of the map and become the root node
  Node.prototype.markAsSelected = function () {
    if (this.$map.rootNode === undefined || this.$map.rootNode === null) {
      $.error ("No root node found - possibly corrupted map object");
      return;
    }

    // Rewire the entire map to have this node as the root one. This also causes
    // losing equilibrium to the entire tree
    this.$map.changeRootNodeTo (this);
  }


  // ~-~-~ Node internal functions beyond this point ~-~-~

  // For internal use - marks recursively an array of nodes and all children of
  // those nodes as needing position (i.e. to be repositioned)
  var markNodesAsNeedingPositionRecursively = function (nodeArray) {
    // Every other sibling of this node will have to be re-positioned around
    // the parent for the first time the children are laid out. Also their
    // children will have to (this is recursive)
    var setNeedsPositionRecursively = function (childrenNodes) {
      $.each (childrenNodes, function () {
        this.hasPosition = false;
        setNeedsPositionRecursively (this.children);
      });
    };
    setNeedsPositionRecursively (nodeArray);
  }

  // Start an animation loop which recursively computes this node and its
  // children (and subchildren, recursively) positions
  Node.prototype.animateToStaticPosition = function() {

    // Set a timeout to prevent the animation for this node (and its children)
    // to last indefinitely due to threshold errors
    var thisNode = this; // For the closure
    clearTimeout (this.stabilityTimeout); // If I received a second command, make
                                          // sure the previous timer isn't running
    this.stopSubtreeMoving = false; // Reset the timeout flag
    this.stabilityTimeout = setTimeout(function () {
      thisNode.$map.rootNode.stopSubtreeMoving = true; // Stop the entire tree
      finalizeConnectors (thisNode.$map);         // Make sure connectors
                                                  // are fully black
      console.log ("MOVEMENT STOPPED TIMEOUT");
    }, MOVEMENT_TIMEOUT * 1000);

    this.animationLoop (); // Start the animation loop
  }

  // This function will call itself repeatedly until all children nodes have
  // reached an equilibrium position
  Node.prototype.animationLoop = function () {

    // For graphical reasons lines shouldn't be shown when the map is being
    // resized and nodes are scattered in their "hasPosition" radial madness.
    // 'linesCanBeShown' is set to true when lines can be drawn nicely
    if (this.$map.linesCanBeShown === true) {
      this.$map.canvas.clear(); // Regardless of whether a node has moved or not,
                                // it is computationally less expensive and easier
                                // to just update the entire canvas for lines
      $.each (this.$map.lines, function () { // Redraw all the lines
        this.draw ();
      });
    }

    // The core of this routine: stops the recursion if my subtree is stable
    // or if this node timeouted
    if ( this.subtreeSeekEquilibrium() === true ||  // Is our subtree stable?
         this.stopSubtreeMoving == true) {          // Or did I timeout?

      if (this.$parent === null) {
        // When the root has reached stability, the entire tree is stable. This
        // is the perfect time to nicely render the connectors at full black
        // opacity gradually
        finalizeConnectors (this.$map);
        this.$map.moveEntireGraphWithRoot = false; // And stop moving the entire graph
                                                   // seeking the center with me
      }

      return; // Avoid the callback and just return if our subtree got equilibrium
    }

    var thisNode = this;
    setTimeout(function () { // Start animation again if subtree isn't stable
      thisNode.animationLoop();
    }, 10);
  }

  // Position a node in the (x;y) coordinates by taking into account the element's
  // dimensions and the force components that are asking to move it (dx;dy)
  Node.prototype.takePosition = function () {

    if (this.dx !== 0) { // Apply dx and dy components if present
      this.x += this.dx * 10;
      this.dx = 0; // empty the calculated force (it has been applied)
    }
    if (this.dy !== 0) {
      this.y += this.dy * 10;
      this.dy = 0;
    }

    this.adjustedX = this.x - (this.elementWidth / 2);
    this.adjustedY = this.y - (this.elementHeight / 2);
    this.$element.css({'left': this.adjustedX + "px",  // Finally position me
                       'top':  this.adjustedY + "px" });
  }

  // Lay off radially this node around its father's position. If the node has
  // children, also lay them off around recursively
  Node.prototype.layNodeAroundParent = function (index) {
    var stepAngle = Math.PI * 2 / this.$parent.node.children.length; // Radiants
    var angle = index * stepAngle
     + (Math.PI * 2 * this.$map.options.nodes_starting_angle / 360); // Start offset
    this.x = (CHILD_PARENT_INIT_DISTANCE * Math.cos(angle)) + this.$parent.node.x;
    this.y = (CHILD_PARENT_INIT_DISTANCE * Math.sin(angle)) + this.$parent.node.y;
    $.each (this.children, function (childIndex) {
      this.layNodeAroundParent (childIndex);
    });
    this.takePosition (); // Immediately place this node
  }

  // Finalize all the connectors of a map by applying the final opacity.
  // Does nothing if they're already fully opaque
  function finalizeConnectors ($map) {
    $.each ($map.lines, function () {
      this.path.animate({'opacity': 1.0}, 1000);
    });
  }

  // Returns 'true' if the entire subtree (i.e. me and my child nodes)
  // have reached equilibrium positions
  Node.prototype.subtreeSeekEquilibrium = function () {
    var isSubtreeStable = true; // Assume my subtree has reached stability

    // I'm included in the search for equilibrium, thus if I'm not positioned,
    // position me at the center of the map if I'm the root
    if (this.hasPosition === false) {
      if (this.$map.rootNode === this) {
        this.x = (this.$map.options.mapArea.width / 2);
        this.y = (this.$map.options.mapArea.height / 2);
        this.hasPosition = true;
      }
      isSubtreeStable = false; // Obviously this means my subtree isn't stable
      $.each (this.children, function (index) { // and nor are my children
        this.hasPosition = false;
      });
    }

    // If my children haven't been positioned yet, lay them around me
    $.each (this.children, function (index) {
        if (this.hasPosition == false) {
          this.layNodeAroundParent (index);
          if (this.$parent.node.isStable) // Do NOT stabilize our position until
            this.hasPosition = true; // our parent got stability. Creates a nice
        }                            // radial effect when positioning children
    });

    // There's no point in asking if I'm stable if I'm being dragged.
    // If this element is being dragged by jQuery UI, just store its position
    if (this.$element.hasClass ("ui-draggable-dragging")) {
      this.x = parseInt (this.$element.css('left'), 10) +
        (this.$element.width() / 2); // Adjust the bottom-right dragging pos
      this.y = parseInt (this.$element.css('top'), 10) +
        (this.$element.height() / 2);
        isSubtreeStable = false; // I'm surely not stable yet
    } else { // If I'm not being dragged, I might be already stable
      this.isStable = this.stabilityReached ();
      isSubtreeStable =  this.isStable && isSubtreeStable; // Am I stable?
      if (isSubtreeStable == false) { // If my subtree isn't stable yet..

        // (If this is the result of a root node swap, apply the force to the entire
        // graph)
        if (this.$map.rootNode === this && this.$map.moveEntireGraphWithRoot) {
          var thisNode = this;
          $.each (this.$map.nodes, function () {
            this.dx += thisNode.dx;
            this.dy += thisNode.dy;
            this.takePosition ();
          });
        }
        this.takePosition (); // ...keep adjusting my position to my equilibrium
      }
    }

    // Do the same for every other children: seek stability recursively
    for (var i = 0; i < this.children.length; ++i) {
      isSubtreeStable = this.children[i].subtreeSeekEquilibrium() && isSubtreeStable;
    }

    return isSubtreeStable;
  }

  // Returns 'true' if I reached stability (i.e. an equilibrium point where
  // all the forces are below a threshold), otherwise return 'false'. The value
  // is also stored in the node property 'stabilityReached'
  Node.prototype.stabilityReached = function () {

    // To determine if I reached stability I need to calculate my resulting
    // force vector and compare it against some minimum thresholds
    var forceVector = this.calculateForceVector ();
    // Save the resulting vector components (these will move our position)
    this.dx += forceVector.dx * 10;
    this.dy += forceVector.dy * 10;

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

  // Using Coulomb's Law, calculate a repulsion force from another node. If
  // provided, the dampFactor damps this force by its amount
  Node.prototype.calculateSingleRepulsionForceFromNode = function (otherNode,
                                                                   dampFactor) {
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
      dampFactor = dampFactor || 1; // If provided, a dampFactor will damp this force
      f = NODES_REPULSIVE_FACTOR / (distance * distance * (dampFactor * dampFactor));
      dx = -f * Math.cos (theta) * xsign;
      dy = -f * Math.sin (theta) * xsign;
    }
    return { dx: dx,
             dy: dy };
  }

  // Using Hooke's Law, calculate an attractive force towards another node
  Node.prototype.calculateSingleAttractiveForceTowardsNode = function (otherNode,
                                                                       ampFactor) {
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
      ampFactor = ampFactor || 1; // If provided, a ampFactor will amplify this force
      f = (15 * distance * 0.01 * ampFactor) / LINES_RESTORING_FACTOR;
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
  // node is the root one (rootNode is 'this'), it will have a force
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

        if (mySiblingNodes[i].beginDragging === true)
          continue; // Do not consider a node immediately being dragged (unreliable)

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

      f = this.calculateSingleAttractiveForceTowardsNode (otherEnd,
        Math.pow(this.depthLevel, 4)); // Powerful damping if we're deeply nested
      fx += f.dx;
      fy += f.dy;
    }

    // If I'm the selected node, push me towards the center of the map (Hooke)
    if (this.$map.rootNode === this) {
      f = this.calculateSingleAttractiveForceTowardsNode ({
        x: (this.$map.options.mapArea.width / 2),
        y: (this.$map.options.mapArea.height / 2),
        centerOfTheMap: true
      }, 25); // An amplify factor is provided to get the graph towards the center
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
    this.path = null; // Could be useful to individually manipulate a connector
  }

  // Draw a connector between two nodes
  Line.prototype.draw = function () {
    this.path = this.$map.canvas.path ("M" + this.startNode.x + ' ' +
      this.startNode.y + "L" + this.endNode.x + ' ' + this.endNode.y).attr(
          {
           'stroke': 'black',
           'opacity': 0.2,
           'stroke-width': 3,
           'stroke-linecap': 'round'
          });
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
      minimumForceThreshold : 0.05,
      mapArea: {
        width:  initialSize,
        height: initialSize
      },
      scale: 1.0, // (*) If the map (or one if its containers) gets scaled with
                  // the 'transform: scale(x)' css property, this needs to be
                  // also set to the same value in order for the drag to work
      nodes_starting_angle:  45 // Degrees - the starting angle to begin radially
                                // position the children for a parent node
    }, options);

    // Set up a drawing area
    if (options.mapArea.width === initialSize)
      options.mapArea.width = this.width();
    if (options.mapArea.height === initialSize)
      options.mapArea.height = this.height();

    this.options = options; // Save it for the $map
    this.nodes = []; // A list of all the nodes of the map (necessary later)
    this.lines = []; // A list of all the connections in the map
    this.rootNode = null; // Root node of the map (always the selected one)
    this.linesCanBeShown = false; // For graphical reasons, avoids artifacts
    this.moveEntireGraphWithRoot = false; // When a root node swap occurs, the
                                          // entire graph needs to be moved to
                                          // the new graph center

    // Add a canvas to the DOM element associated with this selector
    var canvas = Raphael (this[0], 0, 0, options.mapArea.width,
                                         options.mapArea.height);
    this.canvas = canvas; // Also save it as a property
    $(this.canvas).css ('margin-left', '-100px'); // If the canvas has a dimension
                                             // greater than its parent, don't
                                             // hide its lines anyway

    // Add a class to the map DOM object to let node styles be applied
    this.addClass ('nodemap');

    // If the map's element gets resized, every coordinate calculation gets
    // spoiled, we need to prevent this by having a resize callback
    var $thisMap = this;
    this.resize( function () {
      // Update map area width and height
      $thisMap.options.mapArea.width = $thisMap.width();
      $thisMap.options.mapArea.height = $thisMap.height();

      // Update the svg canvas (for connectors)
      $thisMap.canvas.setSize ($thisMap.options.mapArea.width,
                               $thisMap.options.mapArea.height);

      $thisMap.rootNode.isStable = false;   // Destroy root node's stability
      $thisMap.rootNode.hasPosition = false; // and position, this causes the
      $thisMap.rootNode.animateToStaticPosition (); // entire subtree to move
    });

    return this;
  }

  // Create the nodes of the map recursively
  $.fn.createNodes = function (elementsList) { // Typical scope: $('body') map object
    var $map = this; // Save 'this' (the map selector) for any closure
    var $rootLi = $('>ul>li', elementsList);
    if ($rootLi.length === 0) { // A root node must exist
      $.error ("No root node <li> item found - one is needed");
      return;
    }
    $rootLi = $rootLi.get(0);
    // Create the root node
    var $rootNode = $('>a', $rootLi).addNode ($map, null, 0 /* Root has 0 depth */);

    // Now create all the other nodes recursively
    addNodesRecursively ($map, $rootLi, $rootNode, 1 /* Depth level from 1 on */);

    $map.resize(); // Resize the map AFTER all the nodes have been created. This
                   // gives us the possiblity of calculating if nodes need
                   // additional space in the map's area
    $map.linesCanBeShown = true; // Due to a graphic effect during nodes moving,
                                  // it is nicer to just show the connectors when
                                  // nodes have been positioned for the first time
    return this;
  }

  // If a scale factor has been applied to any of our parent containers, this
  // will allow the map nodes' drag to function properly even if scaled (see (*))
  $.fn.setScale = function (scaleFactor) { // Typical scope: $('body') map object
    this.options.scale = scaleFactor;
    return this;
  }

  // Search for a node with the given id in the map and returns the element
  // if it exists. Returns 'null' if there's no node with the given id.
  $.fn.getNodeFromId = function (nodeId) { // Typical scope: $('body') map object

    var nodesWithId = $.grep (this.nodes, function (node) {
      if (node.id === nodeId)
        return true;
      else
        return false;
    });

    if (nodesWithId.length > 1) {
      $.error ("Multiple nodes with the same id found");
      return;
    }

    if (nodesWithId.length === 0)
      return null;
    else
      return nodesWithId[0];
  }

  // ~-~-~ Map internal functions beyond this point ~-~-~

  // - internal use - Adds the nodes recursively to the map given:
  //  - the map object
  //  - the page parent li element
  //  - the parent node <a> element
  function addNodesRecursively ($map, $parentLiElement, $parentNode, depthLevel) {

    // If there's a ul list, foreach li item
    $('>ul>li', $parentLiElement).each ( function () {
      var $newNodeElement = $('>a', this).addNode ($map, $parentNode, depthLevel);
      addNodesRecursively ($map, this, $newNodeElement, depthLevel + 1);
    });
  }

  // Called from a jQuery selector for a node element (e.g. <a>), inserts the
  // node into the map after creating a new node object. If id/href/text are
  // supplied, the selector attributes are overridden
  // Typical scope: $('a') object
  $.fn.addNode = function ($map, $parent, depthLevel, id, href, text) {
    this.node = new Node ($map,      // map to add <a>s, typically $('body')
                          $parent,         // parent <a> selector
                          text || this.text(),         // nodeName
                          id   || this.attr('id'),     // node id
                          href || this.attr('href'),   // href
                          depthLevel);                 // depth level of child
    $map.nodes[$map.nodes.length] = this.node; // Keep a list of all the nodes
                                               // for some distance calculations
    // Everytime a node is added its parent's subtree needs to be reshaped
    if ($parent != null) {
      // Every other sibling of this node will have to be re-positioned around
      // the parent for the first time the children are laid out. Also their
      // children will have to (this is recursive)
      markNodesAsNeedingPositionRecursively ($parent.node.children);
      $parent.node.animateToStaticPosition (); // Start animate the parent's subtree
    } // Root node hasn't a position yet.. and no siblings to mark as needing pos

    return this.node.$element;
  }

  $.fn.changeRootNodeTo = function (node) { // Typical scope: $('body') map object

    this.rootNode = node;

    // Rewire the parent of this node to be a child of this node recursively
    // until we've reached the old root node
    var demoteMyParentToMyChild = function (node, $formerParent, $newParent) {
      if ($formerParent === null)
        return; // We reached the former root node, stop the recursion

      // Add the former parent to node's children
      node.children[node.children.length] = $formerParent.node;
      // Delete 'node' from the children of its former parent
      $formerParent.node.children = $.grep ($formerParent.node.children, function (child) {
        return child != node;
      });
      // Set node as the former parent's new parent
      var $formerParentsFormerParent = $formerParent.node.$parent;
      $formerParent.node.$parent = node.$element;
      // And finally update node's parent to the one passed to the function
      node.$parent = $newParent;
      demoteMyParentToMyChild ($formerParent.node, $formerParentsFormerParent, node);
    };

    demoteMyParentToMyChild (node, node.$parent, null);

    this.moveEntireGraphWithRoot = true; // Moves everything with the new root
    // Causes the entire tree to lose equilibrium and force a reposition
    this.rootNode.animateToStaticPosition ();
  }

} (jQuery));
