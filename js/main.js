/* Start-up: open Home by default and draw the first page. Loaded last, after every route is registered. */
if(!location.hash)history.replaceState(null,"","#/search");
render();
