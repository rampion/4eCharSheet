const addUI = function(defaults){

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

	const CharacterSheet = document.getElementById('CharacterSheet');
	const boxes = (function(){
		const spans = CharacterSheet.getElementsByTagName('span');
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
	//console.log( program );
	
	if ( typeof program.loop  != "undefined") {
		console.log( program.loop );
		alert( "Unable to render formulas (recursive loop):\n\t"+program.loop.join(" ->\n\t") );
		return;
	}
	
	const EditBox = document.getElementById('EditBox');
	const EditBoxTarget = document.getElementById('EditBoxTarget');
	const EditBoxText = document.getElementById('EditBoxText');
	const EditBoxTextMeasure = document.getElementById('EditBoxTextMeasure');
	EditBoxTextMeasure.appendChild(document.createTextNode(''));

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
			if (typeof program.loop == "undefined")
				console.log('uh-oh');
			alert( "Unable to render formula (recursive loop):\n\t"+program.loop.join(" ->\n\t") );
			EditBox.style.display = 'block';
			EditBoxText.focus();
		}
	}, false);

	// hide the EditBox when you click away
	EditBoxText.addEventListener('click', function(click_event) { click_event.stopPropagation(); }, false);
	CharacterSheet.addEventListener('click', function(click_event) { EditBox.style.display = 'none'; }, false);
};
