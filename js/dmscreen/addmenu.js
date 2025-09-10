/**
 * Generic panel menu system
 */
export class AddMenu {
\tconstructor () {
\t\tthis._tabs = [];
\t\tthis._$menuInner = null;
\t\tthis._$tabBar = null;
\t\tthis._activeTab = null;
\t}

\taddTab (tab) {
\t\tthis._tabs.push(tab);
\t\treturn this;
\t}

\tasync pRender () {
\t\tif (!this._$menuInner) return;

\t\tthis._tabs.sort((a, b) => a.getOrder() - b.getOrder());

\t\tconst $tabBar = $(`<div class="w-100 no-shrink"></div>`);
\t\tthis._$tabBar = $tabBar;

\t\tthis._$menuInner.empty().append($tabBar);

\t\t// Create tab bar
\t\tthis._tabs.forEach(tab => {
\t\t\tconst $btn = $(`<button class="btn btn-default mr-2"></button>`)
\t\t\t\t.click(() => this._setActiveTab(tab));

\t\t\tif (tab.getIcon()) $btn.append(`<span class="glyphicon glyphicon-${tab.getIcon()} mr-2"></span>`);
\t\t\t$btn.append(tab.getTitle());

\t\t\t$tabBar.append($btn);
\t\t});

\t\t// Create content area
\t\tconst $content = $(`<div class="w-100 h-100 min-h-0"></div>`).appendTo(this._$menuInner);
\t\tthis._tabs.forEach(tab => tab.render($content));

\t\t// Set active tab
\t\tif (this._tabs.length) await this._setActiveTab(this._tabs[0]);
\t}

\tasync _setActiveTab (tab) {
\t\tif (this._activeTab) {
\t\t\tthis._activeTab.doHide();
\t\t\tthis._$tabBar.find(`.btn`).removeClass("active");
\t\t}

\t\tthis._activeTab = tab;
\t\tthis._$tabBar.find(`.btn`).eq(this._tabs.indexOf(tab)).addClass("active");
\t\ttab.doShow();

\t\tif (tab.pDoTransitionActive) await tab.pDoTransitionActive();
\t}

\thasActiveTab () {
\t\treturn this._activeTab != null;
\t}

\tgetActiveTab () {
\t\treturn this._activeTab;
\t}

\tsetPanel (panel) {
\t\tthis._panel = panel;
\t}

\tgetPanel () {
\t\treturn this._panel;
\t}

\tclose () {
\t\tif (this._$menuInner) this._$menuInner.empty();
\t}
}

export class InitiativeTrackerTab {
\tconstructor (board) {
\t\tthis._board = board;
\t\tthis._$wrpTab = null;
\t}

\tgetTitle () { return "Initiative Tracker"; }
\tgetIcon () { return "hourglass"; }
\tgetOrder () { return 10; }

\trender ($parent) {
\t\tthis._$wrpTab = $(`<div class="panel-content-wrapper-inner"></div>`).appendTo($parent);
\t\tthis._doRender();
\t}

\t_doRender () {
\t\tconst $wrpButtons = $(`<div class="ve-flex-col"></div>`);

\t\t// DM options
\t\tconst $wrpDm = $(`<div class="ve-flex-col mb-2">`).appendTo($wrpButtons);
\t\t$(`<div class="bold mb-1">DM Options:</div>`).appendTo($wrpDm);

\t\tconst $btnManual = $(`<button class="btn btn-sm btn-default w-100 mb-1">Manual Initiative Tracker</button>`)
\t\t\t.click(() => this._addInitTrackerPanel(false, false))
\t\t\t.appendTo($wrpDm);

\t\tconst $btnWebsocketDm = $(`<button class="btn btn-sm btn-primary w-100">Create WebSocket Channel</button>`)
\t\t\t.click(() => this._addInitTrackerPanel(true, false))
\t\t\t.appendTo($wrpDm);

\t\t// Player options
\t\tconst $wrpPlayer = $(`<div class="ve-flex-col">`).appendTo($wrpButtons);
\t\t$(`<div class="bold mb-1">Player Options:</div>`).appendTo($wrpPlayer);

\t\tconst $btnPlayerManual = $(`<button class="btn btn-sm btn-default w-100 mb-1">Join Manual Initiative Tracker</button>`)
\t\t\t.click(() => this._addPlayerPanel(false))
\t\t\t.appendTo($wrpPlayer);

\t\tconst $btnPlayerWebsocket = $(`<button class="btn btn-sm btn-primary w-100">Join WebSocket Channel</button>`)
\t\t\t.click(() => this._addPlayerPanel(true))
\t\t\t.appendTo($wrpPlayer);

\t\t// Help text
\t\tconst $wrpHelp = $(`<div class="ve-flex-col mt-3">`).appendTo($wrpButtons);
\t\t$(`<div class="ve-muted small">WebSocket channels allow players to join without tokens and support multiple simultaneous combat sessions.</div>`).appendTo($wrpHelp);

\t\tthis._$wrpTab.empty().append($wrpButtons);
\t}

\t_addInitTrackerPanel (isWebSocket) {
\t\tthis._board.getMenu().close();
\t\tthis._board.getCurrentPanel().doPopulate_InitiativeTracker({isWebSocket});
\t}

\t_addPlayerPanel (isWebSocket) {
\t\tthis._board.getMenu().close();
\t\tthis._board.getCurrentPanel().doPopulate_InitiativeTrackerPlayer({isWebSocket});
\t}

\tdoShow () { this._$wrpTab.showVe(); }
\tdoHide () { this._$wrpTab.hideVe(); }
}

/**
 * Allow users to search and filter data like stats, rules, etc.
 */
export class SearchTab {
\tconstructor (board) {
\t\tthis._board = board;
\t\tthis._$wrpTab = null;
\t}

\tgetTitle () { return "Search"; }
\tgetIcon () { return "search"; }
\tgetOrder () { return 20; }

\trender ($parent) {
\t\tthis._$wrpTab = $(`<div class="panel-content-wrapper-inner"></div>`).appendTo($parent);
\t\tthis._doRender();
\t}

\t_doRender () {
\t\tconst $searchBox = $(`<input type="search" class="form-control mb-2" placeholder="Search...">`);
\t\tconst $results = $(`<div class="search-results"></div>`);

\t\t$searchBox.on("input", () => {
\t\t\tconst term = $searchBox.val().toLowerCase();
\t\t\t// TODO: Implement search against board.availContent
\t\t});

\t\tthis._$wrpTab.empty().append($searchBox, $results);
\t}

\tdoShow () { this._$wrpTab.showVe(); }
\tdoHide () { this._$wrpTab.hideVe(); }
}

/**
 * Import/export/manage image panels
 */
export class ImageTab {
\tconstructor (board) {
\t\tthis._board = board;
\t\tthis._$wrpTab = null;
\t}

\tgetTitle () { return "Images"; }
\tgetIcon () { return "picture"; }
\tgetOrder () { return 30; }

\trender ($parent) {
\t\tthis._$wrpTab = $(`<div class="panel-content-wrapper-inner"></div>`).appendTo($parent);
\t\tthis._doRender();
\t}

\t_doRender () {
\t\tconst $wrpUpload = $(`<div class="ve-flex-col"></div>`);

\t\t// Image URL
\t\tconst $iptUrl = $(`<input type="text" class="form-control mb-2" placeholder="Image URL">`);
\t\tconst $btnAdd = $(`<button class="btn btn-primary">Add Image</button>`)
\t\t\t.click(() => {
\t\t\t\tconst url = $iptUrl.val().trim();
\t\t\t\tif (!url) return;

\t\t\t\tthis._board.getMenu().close();
\t\t\t\tthis._board.getCurrentPanel().doPopulate_Image(url);
\t\t\t});

\t\t$wrpUpload.append($iptUrl, $btnAdd);
\t\tthis._$wrpTab.empty().append($wrpUpload);
\t}

\tdoShow () { this._$wrpTab.showVe(); }
\tdoHide () { this._$wrpTab.hideVe(); }
}
