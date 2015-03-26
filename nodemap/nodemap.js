(function ($) {
  'use strict';

  // ---------- Node class and methods ----------
  Node = function (mapObject, parentNode, nodeName, href) {

    this.name = nodeName;
    this.href = href;

    // Create the node element in the page and append it to the map's object
    this.element = $('<a href="' + this.href + '">' + this.name + '</a>')
      .addClass('node');
    mapObject.prepend (this.element);

    // The node will be moved directly from code
    this.element.css ('position', 'absolute');

    if (parentNode == null) {} // I'm the root TODO something
  }

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

    return this.each(function () { // Generate a node map
        // Set up a drawing area
        if (options.mapArea.width === initialSize)
          options.mapArea.width = $window.width();
        if (options.mapArea.height === initialSize)
          options.mapArea.height = $window.height();

        // Add a canvas to the selector
        this.canvas = Raphael (0, 0, options.mapArea.width,
                                     options.mapArea.height);

        // Add a class to the map DOM object to let node styles be applied
        $(this).addClass ('nodemap');
      });
  };

  $.fn.addRootNode = function (nodeName) {
    var node = new Node (this,      // Map object (might have multiple DOM
                                    // elements attached)
                         null,      // No parent (root)
                         nodeName,  // nodeName
                         '/');      // h
    this.root = node;
    return jQuery;
  };

} (jQuery));
