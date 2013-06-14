function PinKeyPad(div) {
	var $div = $(div);
	$div.addClass('pinkeypad');
	var control = this;
	$div.data('control', control);
	this.currentPin = '';

	var pinLength = parseInt($div.attr('data-pin-length') || '5');

	this.keys = [];
	this.feedbackCells = [];

	var $feedback = $('<div class="feedback"/>');
	$div.append($feedback);

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


	for (var pd = 0; pd < pinLength; pd++) {
		(function(pd) {
			var $cell = $('<div class="cell"/>');
			control.feedbackCells[pd] = { cell: $cell };
			$feedback.append($cell);
		})(pd);
	}

	var $keypad = $('<div class="keypad"/>');
	$div.append($keypad);

	this.keyClick = function(key) {
		var keynum = key.index;
		control.currentPin = control.currentPin + ('' + keynum);
		$.each(control.feedbackCells, function(i,v) {
			v.cell.toggleClass('filled', control.currentPin.length > i);
		});
		if (control.currentPin.length == pinLength) {
			var event = createCustomEvent('enter', { detail: { control: control, pin: this.currentPin }});
			div.dispatchEvent(event);
		}
	};

	$.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], function(i,k) {
		var $key = $('<button class="key"/>');
		$key.addClass('key' + k);
		var $keytext = $('<span class="text"/>');
		$keytext.text(k);
		$key.append($keytext);
		var key = { button: $key, index: k };
		$keypad.append($key);
		control.keys[k] = key;
		$key.on('click', function() { control.keyClick(key); })
	});

	this.bind = function(propname, target) {
		if (typeof target == 'function')
			div.addEventListener(propname, target, false);
	};

	this.pin = function(newpin) {
		if (arguments.length = 1) { 
			this.currentPin = newpin;
		}
	};
}