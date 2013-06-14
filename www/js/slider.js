function touchCoords(e) {
	var c = e;
	if ('originalEvent' in c)
		c = c.originalEvent;
	if ('targetTouches' in c)
		c = c.targetTouches[0];
	return c;
}

function Slider(div) {
	var $div = $(div);
	$div.addClass('slider');
	var control = this;
	$div.data('control', control);
	this.grabbed = false;
	this.endOptions = {};
	this.optionsMode = false; // true when dragging vertically for options
	this.currentOption = null;

	this.grabHandle = function(e) {
		if (control.disabled)
			return;
		console.log('slider grabbed');
		control.grabbed = true;
		control.$div.addClass('grabbed');
		var c = touchCoords(e); 
		control.grab = { originX: c.pageX, originY: c.pageY };
		control.dragWidth = control.calcDragWidth();
	}

	this.reverse = function(isReverse) {
		this.direction(isReverse ? -1 : 1);
	}
	
	this.calcDragWidth = function() { return control.$div.width() - control.$handle.outerWidth(true); };

	this.bind = function(propname, target) {
		if (typeof target == 'function')
			div.addEventListener(propname, target, false);
	}

	var createCustomEvent;
	if (typeof CustomEvent === 'undefined') {
		createCustomEvent = function(type, dict) {
			var e = document.createEvent('Event');
			e.initEvent(type, dict['bubbles'], dict['cancelable']);
			if (dict.detail) {
				if (!e.detail)
					e.detail = {};
				for (q in dict.detail)
					e.detail[q] = dict.detail[q];
			}
			return e;
		};
	}
	else {
		createCustomEvent = function(type, dict) {
			return new CustomEvent(type, dict);
		}
	}

	this.handleComplete = function(d, option) {
		var side = d == 1 ? 'right' : 'left';
		var event = createCustomEvent('slide' + side, { detail: { control: this, option: option, direction: d }});
		div.dispatchEvent(event);
	}
	
	this.ungrabHandle = function() {
		console.log('slider ungrabbed');
		control.grabbed = false;
		control.$div.removeClass('grabbed');
		if (control.atMax) {
			var d = control.direction();
			if (control.optionsMode) {
				var option = control.currentOption;
				control.exitOptionsMode();
				if (option) {
					control.handleComplete(d, option)
				}
			}
			else {
				control.handleComplete(d, option);
			}
		}
		delete control.grab;
		if (!control.disabled)
			control.moveHandle(0);
	}
	
	this.dragHandle = function(e) {
		e.preventDefault();
		var c = touchCoords(e);
		if (control.optionsMode) {
			var dy = c.pageY - control.grab.originY;
			dy = control.clampHandleY(dy);
			control.moveHandleY(dy);
		}
		else {
			var dx = c.pageX - control.grab.originX;
			dx = dx * control.dir;
			var dy = c.pageY - control.grab.originY;
			if (Math.abs(dy) > control.$handle.height() * 2.8) {
				control.ungrabHandle();
				return;
			}
			dx = control.clampHandle(dx);
			control.moveHandle(dx);
			control.atMax = dx == control.dragWidth;
			if (control.atMax) {
				var d = control.direction();
				var eo = control.endOptions[d];
				if (eo && eo.length) {
					control.showOptions(eo);
				}
			}
		}
	}
	
	this.showOptions = function(o) {
		if (!control.optionsMode)
			control.enterOptionsMode(o);
	}
	
	this.disableWith = function(message) {
		if (!control.disabled) {
			control.disabled = true;
			control.$div.addClass('disabled');
		}
		control.disableMessage = message;
		control.updateCaption();
		if (control.grabbed)
			control.ungrabHandle();
	}
	
	this.enable = function() {
		control.disabled = false;
		control.$div.removeClass('disabled');
		control.dragWidth = control.calcDragWidth();
		control.disableMessage = null;
		control.updateCaption();
		if (!control.grabbed)
			control.moveHandle(0);
	}
	
	this.enterOptionsMode = function(o) {
		control.optionsMode = true;
		control.normalHeight = control.$div.outerHeight();
		var activeOptions = [];
		var $list = $('<div class="optionlist"/>');
		var side = control.direction() == 1 ? 'right' : 'left';
		$list.addClass(side);
		for (var i = 0; i < o.length; i++) {
			var otext = o[i];
			var opt = {};
			opt.text = otext;
			opt.$div = $('<div class="option"/>');
			opt.$div.text(otext);
			$list.append(opt.$div);
			activeOptions.push(opt);
		}
		for (var i = 0; i < activeOptions.length; i++)
			activeOptions[i].index = i;
		control.$div.prepend($list);
		control.$div.addClass('optionsmode');
		var newHeight = control.normalHeight + $list.height();
		control.$optionsList = $list;
		control.activeOptions = activeOptions;
		control.animating = true;
		control.$div.css({overflow: 'hidden', height: newHeight + 'px', '-webkit-transition': 'height 0.2s'});
		control.dragHeight = newHeight - control.$handle.outerHeight();
	}
	
	this.exitOptionsMode = function() {
		control.moveHandleY(0);
		control.optionsMode = false;
		control.$div.css({overflow: 'visible'});
		control.$optionsList.remove();
		control.$div.outerHeight(control.normalHeight);
		control.currentOption = null;
		delete control.activeOptions;
	}
	
	this.moveHandle = function(dx) {
		var tx = (control.dir == 1) ? dx : control.dragWidth - dx;
		var css = {'left': tx + 'px', '-webkit-transform': 'translate3d(0,0,0)'};
		css['-webkit-transition'] = control.grabbed ? '' : 'left 0.1s ease-out';
		control.$handle.css(css);
		var d = control.dir;
		if (Math.abs(dx) > Math.abs(control.dragWidth / 2))
			d = -d;
		control.$caption.toggleClass('left', d == 1);
		control.$caption.toggleClass('right', d == -1);
	}
	
	this.moveHandleY = function(dy) {
		control.dragWidth = control.calcDragWidth();
		var dx = control.direction() == 1 ? control.dragWidth : 0;
		control.$handle.css({'left': dx + 'px', 'bottom': -dy + 'px', '-webkit-transform': 'translate3d(0,0,0)'});
		// try to see which option is current
		var currentOption = null;
		if (!control.animating) {
			var y = dy + control.$div.height() - (control.$handle.outerHeight() / 2);
			for (var i = 0; i < control.activeOptions.length; i++) {
				var o = control.activeOptions[i];
				var top = control.activeOptions[i].$div.position().top;
				var bottom = top + control.activeOptions[i].$div.outerHeight();
				if (y >= top && y < bottom)
					(currentOption = control.activeOptions[i]).$div.addClass('current');
				else
					control.activeOptions[i].$div.removeClass('current');
			}
		}
		control.currentOption = currentOption;
	}
	
	this.clampHandle = function(dx) {
		if (dx < 0)
			dx = 0;
		if (dx > control.dragWidth)
			dx = control.dragWidth;
		return dx;
	}
	
	this.clampHandleY = function(dy) {
		if (dy > 0)
			dy = 0;
		if (dy < -control.dragHeight)
			dy = -control.dragHeight;
		return dy;
	}
	
	this.direction = function(b) {
		if (b && control.dir != b) {
			control.$div.removeClass(control.dir === 1 ? 'left' : 'right');
			control.dir = b;
			control.$div.addClass(control.dir === 1 ? 'left' : 'right');
			control.updateCaption();
			control.dragWidth = control.calcDragWidth();
			control.moveHandle(0);
			var eo = control.endOptions[b];
			var hasOptions = eo && eo.length;
			if (hasOptions)
				control.$div.addClass('hasoptions');
			else
				control.$div.removeClass('hasoptions');
		}
		return control.dir;
	}
	
	this.updateCaption = function() {
		if (control.disabled)
			control.$captiontext.text(control.disableMessage);
		else
			control.$captiontext.text(control.$div.data(control.dir == 1 ? 'left' : 'right'))
		this.$captiontext.css('top', ((this.$caption.outerHeight() - this.$captiontext.outerHeight()) / 2) + 'px');
	}
	
	this.setEndOptions = function(forDirection, options) {
		control.endOptions[forDirection] = options;
	}
	
	// add a slide handle
	$handle = $('<div class="handle"/>');
	
	$caption = $('<div class="caption"/>');
	$captiontext = $('<div class="text"/>');
	$caption.append($captiontext);
	
	$div.append($caption);
	
	$handle.touchstart(function(e) { if (!control.grabbed) { control.grabHandle(e); } });
	$handle.touchend(function() { if (control.grabbed) { control.ungrabHandle(); } });
	$(document).touchmove(function(e) { if (control.grabbed) { control.dragHandle(e); } });
	$(document).touchend(function() { if (control.grabbed) { control.ungrabHandle(); } });
	
	$div.append($handle);
	
	$div.on('webkitTransitionEnd', function(event) {
		var e = event.originalEvent;
		if (e.propertyName == 'height' && e.target == $div.get(0)) {
			control.animating = false;
			control.dragHeight = control.$div.height() - control.$handle.outerHeight(true);
			if (!control.optionsMode)
				control.$div.removeClass('optionsmode');
		}
		else if (e.propertyName == 'left' && e.target == $handle.get(0)) {
			// the following works around an apparent bug in webkit whereby visual updates of a class
			// removal may not have been applied if the element was being animated
			if (!control.grabbed)
				control.$div.removeClass('grabbed');
		}
	});
	
	this.$div = $div;
	this.$handle = $handle;
	this.$caption = $caption;
	this.$captiontext = $captiontext;
	this.reverse($div.data('direction') == 'reverse');
	if ($div.data('right-options')) {
		var opts = $div.data('right-options');
		if (typeof opts === 'string')
			opts = JSON.parse(opts);
		this.setEndOptions(1, opts);
	}
	if ($div.data('left-options')) {
		var opts = $div.data('left-options');
		if (typeof opts === 'string')
			opts = JSON.parse(opts);
		this.setEndOptions(-1, opts);
	}
	$caption.height($div.outerHeight());
	this.updateCaption();
}
