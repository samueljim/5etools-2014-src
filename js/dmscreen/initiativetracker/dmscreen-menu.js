import {PANEL_TYP_INITIATIVE_TRACKER, PANEL_TYP_INITIATIVE_TRACKER_PLAYER_V1} from "../dmscreen-consts.js";

export class InitiativeTrackerTab {
\tconstructor (board) {
\t\tthis._board = board;
\t\tthis._$wrpTab = null;
\t}

\tgetTitle () { return "Initiative Tracker"; }
\tgetIcon () { return "hourglass"; } // Font Awesome icon class
\tgetOrder () { return 10; } // Insert early in the list

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

\t_addInitTrackerPanel (isWebSocket = false) {
\t\tthis._board.getMenu().close();
\t\tthis._board.getCurrentPanel().doPopulate_InitiativeTracker({isWebSocket});
\t}

\t_addPlayerPanel (isWebSocket = false) {
\t\tthis._board.getMenu().close();
\t\tthis._board.getCurrentPanel().doPopulate_InitiativeTrackerPlayer({isWebSocket});
\t}

\tdoShow () { this._$wrpTab.showVe(); }
\tdoHide () { this._$wrpTab.hideVe(); }
}
