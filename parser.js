// want to parse form cell for display.
// click on form cell to view full / edit
// when not selected, see rendered version.
// 
// [ ENTRY ] => [ DISPLAY ]
//
// VAR is the label for a cell with value 2
// 
// [ blah blah blah ] => [ blah blah blah ]
// [=( 1 + 2 /* from this */ + 3 /* from that */ )=] => [ 6 ]
// [=( 1 + 2 + 3 )=] => [ 6 ]
// [=( 1 + VAR )=] => [ 3 ]
// [ blah =VAR= blah ] => [ blah 2 blah ]
// [ blah =(VAR + 2)= blah ] => [ blah 4 blah ]
//
// cells can have
//	* a label
//	* a color
//
// need a dependency tree in order to render correctly
// (avoid circular deps, allows to just rerender changed cells)
