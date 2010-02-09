const addUI = function(region_id, defaults){

	if (!defaults) defaults = {};

	const addClass = function(elt, class) {
		const classes = elt.className.split(' ');
		if (classes.indexOf(class) < 0)
			classes.push(class);
		elt.className = classes.join(' ');
	};
	const hasClass = function(elt, class) {
		const classes = elt.className.split(' ');
		return (classes.indexOf(class) >= 0);
	};
	const remClass = function(elt, class) {
		const classes = elt.className.split(' ');
		const i = classes.indexOf(class);
		if (i >= 0)
			classes.splice(i,1);
		elt.className = classes.join(' ');
	};

	const region = document.getElementById(region_id);
	const boxes = (function(){
		const spans = region.getElementsByTagName('span');
		const boxes = {};
		for (var i=0; i < spans.length; ++i) {
			var span = spans[i];
			if (hasClass(span, 'box')) { 
				boxes[span.id] = span;
				if (!defaults[span.id]) defaults[span.id] = "";
			}
		}
		return boxes;
	})();
	const program = compileAndEval( defaults );
	
	if ( typeof program.loop  != "undefined") {
		alert( "Unable to render formulas (recursive loop):\n\t"+program.loop.join(" ->\n\t") );
		return;
	}
	
	const EditBox = document.createElement('div');
	EditBox.id = 'EditBox';
	const EditBoxTarget = document.createElement('div');
	EditBox.appendChild(EditBoxTarget);
	EditBoxTarget.id = 'EditBoxTarget';
	const EditBoxText = document.createElement('textarea');
	EditBox.appendChild(EditBoxText);
	EditBoxText.id = 'EditBoxText'
	const EditBoxTextMeasure = document.createElement('pre');
	EditBox.appendChild(EditBoxTextMeasure);
	EditBoxTextMeasure.id = 'EditBoxTextMeasure'
	EditBoxTextMeasure.appendChild(document.createTextNode(''));

	if (region.firstChild)
		region.insertBefore( EditBox, region.firstChild );
	else
		region.appendChild( EditBox );

	// go through each of the entry boxes
	for (var id in boxes) (function(id, box){
		// set display text
		box.innerHTML = program.graph[id].value;

		// edit this box on click/tab
		const box_select = function(event) {
			EditBoxTarget.innerHTML = id;
			EditBox.style.display = 'block';
			addClass(box, 'selected');
			EditBoxText.value = program.graph[id].formula;
			resizeEditBoxText();
			EditBoxText.focus();
			event.stopPropagation();
		};
		box.addEventListener("focus", box_select, false);
		box.addEventListener("click", box_select, false);

		// highlight this box
		box.addEventListener("mouseover", function(over_event) { addClass(box, "moused"); }, false);
		box.addEventListener("mouseout", function(out_event) { remClass(box, "moused"); }, false);
	})(id, boxes[id]);
	

	// make the EditBox fit the text
	const resizeEditBoxText = function(event) {
		EditBoxTextMeasure.firstChild.nodeValue = EditBoxText.value;
		EditBoxTextMeasure.style.display = 'block';
		EditBoxText.style.height = (EditBoxTextMeasure.offsetHeight+20) + 'px';
		EditBoxTextMeasure.style.display = 'none';
	};
	EditBoxText.addEventListener('keyup', resizeEditBoxText, false);


	// save changes when done
	EditBoxText.addEventListener('blur', function(blur_event) {
		const id = EditBoxTarget.innerHTML;
		const box = boxes[id];
		if (!box) return;

		remClass(box,'selected');
		switch(program.update(id, EditBoxText.value)){
		case 'change':
			(program.graph[id].value != defaults[id] ? addClass : remClass)(box, 'edited');
			box.innerHTML = program.graph[id].value;
			break;
		case 'loop':
			alert( "Unable to render formula (recursive loop):\n\t"+program.loop.join(" ->\n\t") );
			EditBox.style.display = 'block';
			EditBoxText.focus();
		}
	}, false);

	// hide the EditBox when you click away
	EditBoxText.addEventListener('click', function(click_event) { click_event.stopPropagation(); }, false);
	region.addEventListener('click', function(click_event) { EditBox.style.display = 'none'; }, false);
};
