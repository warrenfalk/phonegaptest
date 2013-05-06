this.Screens = {
	_stack: [],
	_top: null,
	_screens: {},
	
	push: function(screen, model) {
		model = model || (this._top ? this._top.model : null) || [];
		if (typeof screen === 'string')
			screen = this._screens[screen];
		if (this._top)
			this._top.$element.hide();
		screen.$element = $("<div/>");
		screen.model = model;
		this._stack.push(this._top = screen);
		screen.$element.append($('#' + screen.template).html());
		$("#page").append(screen.$element);
		if (screen.initialize)
			screen.initialize(screen.$element, model);
		ko.applyBindings(model, screen.$element.get(0));
		return screen;
	},
	
	pop: function() {
		if (this._stack.length <= 1)
			return;
		var old = this._top = this._stack.pop();
		this._top.$element.remove();
		this._top = this._stack[this._stack.length - 1];
		this._top.$element.show();
		return old;
	},
	
	define: function(screens) {
		for (name in screens) {
			var screen = screens[name];
			screen.name = name;
			screen.template = screen.template || 'screen_' + screen.name;
			this._screens[name] = screen;
		}
	},
	
	showError: function(error) {
		$errdiv = $('<div id="error"/>');
		$errdiv.text("Error: " + error.stack);
		$("#page").append($errdiv);
	},
	
	makeList: function(recordTemplate, recordClass, parentElement, data, clickHandler) {
		if (typeof recordTemplate == 'string')
			recordTemplate = Handlebars.compile($('#' + recordTemplate).html());
		
		var $parentElement = $('#' + parentElement);
	    
	    $.each(data, function(i, record) {
			// construct row from template
			var $record = $('<div class="' + recordClass + ' record"/>').append(recordTemplate(record));
			$parentElement.append($record);
			
			$record.click(function() { clickHandler(record); });
	    });
		
	},
	
	init: function() {
		document.addEventListener('deviceready', function() {
			document.addEventListener('backbutton', function() {
				var top = Screens._top;
				if (!top) {
					navigator.ap.exitApp();
					return true;
				}
				if (!top.back) {
					if (Screens._stack.length > 1)
						Screens.pop();
					return false;
				}
				top.back();
				return false;
			}, true);
		}, false);
	}
};

