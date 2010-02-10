const db = google.gears.factory.create('beta.database');
db.open('4eCharSheet');
db.execute('CREATE TABLE IF NOT EXISTS sheets ('+
		'sheet_name TEXT NOT NULL,'+
		'id TEXT NOT NULL,'+
		'formula TEXT NOT NULL,'+
		'PRIMARY KEY( sheet_name, id )'+
')');

const short_name = (function(){
	const index = document.URL.indexOf('?#') + 2;
	if (index == 1 || index == document.URL.length)
	{
		document.getElementById('CharacterSheet').style.display = 'none';
		const SheetSelect = document.createElement('div');
		SheetSelect.id = 'SheetSelect';

		const rs = db.execute('SELECT DISTINCT sheet_name FROM sheets');
		if (rs.isValidRow()) {
			SheetSelect.innerHTML = 'Select an existing sheet:<br/><ul>';
			do {
				var sheet_name = rs.field(0);
				SheetSelect.innerHTML += '<li><a href="?#'+sheet_name+'">'+sheet_name+'</a></li>';
				rs.next();
			} while (rs.isValidRow());
			SheetSelect.innerHTML += '</ol>';
		}
		rs.close();

		SheetSelect.innerHTML += 'Start a new sheet:';
		const NewSheet = document.createElement('input');
		NewSheet.id = 'NewSheet';
		SheetSelect.appendChild(NewSheet);
		NewSheet.addEventListener('change', function(change_event){
			window.location.assign(document.URL + '?#' + NewSheet.value);
			window.location.reload(true);
		}, false);

		document.body.appendChild(SheetSelect);
	}
	return document.URL.slice(index);
})();

const load = function(id, formula) {
	const rs = db.execute(
		'SELECT formula FROM sheets WHERE sheet_name = ? AND id = ? LIMIT 1',
		[ short_name, id ]
	);
	if (rs.isValidRow()) formula = rs.field(0);
	rs.close();
	return formula;
};
const save = function(id, formula) {
	db.execute(
			'INSERT OR REPLACE INTO sheets (sheet_name, id, formula) VALUES ( ? , ? , ? )',
			[ short_name, id, formula ]
	);
	return true;
};
