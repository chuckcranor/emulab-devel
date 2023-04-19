(function ( $ ) {

    /*
     * The problem to solve is that Bootstrap 4/5 changed the names of
     * all the data attributes to "data-bs-" (from just "data-"). Which
     * makes every tooltip/popover/etc incompatible with Bootstrap 4/5.
     *
     * The toggle is also renamed from "data-toggle" to
     * "data-bs-toggle" but that is less of a problem for tooltips and
     * popovers since they always need explicit initialization. The
     * problem is more with things like nav-tabs modals that need the
     * correct toggle name for automatic initialization.
     *
     * AND ... as part of their goal to not depend on JQuery, they do
     * not initialize the jquery plugins until the DOM is fully
     * loaded. So the first problem is that the plugins might not even
     * be defined when our initialize function runs cause we use the
     * same event, and we appear to get called first, and so the
     * plugins are not installed yet and so:
     *
     *    	$('[data-toggle="tooltip"]').tooltip({});
     *
     * This fails with an undefined function. So our plugin (which
     * is to maintain source compatability) has to use the new and
     * approved method of calling Bootstrap functions.
     */
    function initialize()
    {
	//console.info("BAR: initialize");
	
	$.fn["tooltip"] = function (arg) {
	    //console.info("tooltip", arg);
	    return this.each(function () {
		var tip = bootstrap.Tooltip.getInstance(this);
		
		// Method call
		if (arg && typeof(arg) == "string") {
		    // uninitialized tip. 
		    if (!tip) {
			console.info("Uninitialized tip", arg, this);
			return null;
		    }
		    if (arg == "destroy") {
			arg = "dispose";
		    }
		    if (arg in tip === false) {
			console.info("Unknown tip method", arg, tip);
			return null;
		    }
		    return tip[arg]();
		}
		// Just return if already exists.
		if (tip) {
		    return tip;
		}
		// Initialization
		var t = $.extend({}, {"title" : $(this).attr("title"),
				      "sanitize" : false})
		if (arg) {
		    t = $.extend(t, arg);
		}

		// Add data- values from the original DOM.
		_.each($(this).data(), function (val, key) {
		    t[key] = val
		});
		//console.info(t);
		return new bootstrap.Tooltip(this, t);
	    });
	};
 
	$.fn["popover"] = function (arg) {
	    //console.info("popover", arg);
	    return this.each(function () {
		//console.info(this);
		// Method call
		if (arg && typeof(arg) == "string") {
		    if (arg == "destroy") {
			arg = "dispose";
		    }
		    var pop = bootstrap.Popover.getInstance(this);
		    if (arg == "getInstance") {
			return pop;
		    }
		    return pop[arg]();
		}
		var pop = bootstrap.Popover.getInstance(this);
		// Just return if already exists.
		if (pop) {
		    return pop;
		}
		// Initialization
		var t = {"sanitize" : false};
		if (arg) {
		    t = $.extend(t, arg);
		}
	    
		// Add data- values from the original DOM.
		_.each($(this).data(), function (val, key) {
		    t[key] = val
		});
		//console.info("t", t);
		return new bootstrap.Popover(this, t);
	    });
	};
    }
    /*
     * Define these immediately cause we use them before the Bootstrap
     * plugins are installed (see above comment).
     */
    initialize();

    /*
     * And then this will run *after* the Bootstrap events, so that
     * we can define them again (ours got overwritten).
     */
    document.addEventListener('DOMContentLoaded', () => {
	initialize();
    });
}( jQuery ));
