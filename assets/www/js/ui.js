this.ui = {
		highlight: function() {
			$this = $(this);
			$this.cancel = false;
			setTimeout(function() {
				if ($this.cancel)
					return;
				$this.addClass('highlight');
				var remove = function() {
					$this.removeClass('highlight');
				}
				$(document).scroll(remove)
				$this.click(remove);
				$this.dblclick(remove);
				$this.mouseout(remove);
				$this.mouseup(remove);
				$this.touchend(remove);
			}, 100);
			var cancel = function() {
				$this.cancel = true;
			}
			$(document).scroll(cancel);
		}
};
