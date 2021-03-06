import { UIHandler } from "./UIHandler";
import { CellEditor } from "./CellEditor";
import { Sheet } from "../core/Sheet";
import { WebSheetUIHandler } from "./DocumentHandler";
import { SheetUIHandler } from "./SheetUIHandler";
import { OpenDocument } from "../core/Document";
import { DocumentRenderer } from "../rendering/DocumentRenderer";
import { ResizeHandler } from "./ResizeHandler";

export class UIHandlerController {

    private handlers:UIHandler[] = [];
    private lockedOn:UIHandler = null;
    cellEditor:CellEditor;

    constructor(public websheet:OpenDocument,public renderer:DocumentRenderer) {
        this.cellEditor = new CellEditor(this);
        this.addHandlers();
        this.attachEvents();
        websheet.addOnChange(() => this.cellEditor.updateEitorAppearance());
    }

    private addHandlers() {
        this.handlers.push(new WebSheetUIHandler(this));
        this.handlers.push(new SheetUIHandler(this));
        this.handlers.push(new ResizeHandler(this));
    }

    public alterColumn(columnId, delta:number) {
        this.websheet.execCommand('alter-column', columnId, delta);
    }

    public alterRow(rowId, delta:number) {
        this.websheet.execCommand('alter-row', rowId, delta);
    }

    get locked() {
        return !!this.lockedOn ;
    }

    public lock(uiHandler:UIHandler) {
        this.lockedOn = uiHandler;
    }

    public unlock() {
        this.lockedOn = null;
    }

    public resetCursor() {
        this.renderer.Element.style.cursor = '';
    }

    public changeCursor(cursor: string){
        this.renderer.Element.style.cursor = cursor;
    }

    attachEvents() {
        let element = this.renderer.Element;
        let overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.zIndex = '9999';
        element.appendChild(overlay);

        let controler = this;

        let getXY = function (evt) {
            var x = evt.offsetX || evt.layerX || (evt.clientX - element.offsetLeft);
            var y = evt.offsetY || evt.layerY || (evt.clientY - element.offsetTop);

            return {'x': x, 'y': y}
        };

        $(overlay)
            .mousedown(function (evt) {
                let pos = getXY(evt);
                controler.mouseDown(pos.x, pos.y);
            })
            .mousemove(function (evt) {
                let pos = getXY(evt);
                controler.mouseMove(pos.x, pos.y);
            })
            .mouseup(function (evt) {
                let pos = getXY(evt);
                controler.mouseUp(pos.x, pos.y);
            })
            .click(function (evt) {
                controler.click();
            })
            .dblclick(function (evt) {
                controler.dblClick();
            })
            .bind('mousewheel', function (evtE) {
                var evt:any = evtE;
                let dx = evt.originalEvent.wheelDeltaX;
                let dy = evt.originalEvent.wheelDeltaY;
                controler.mouseWheel(dx, dy);
                evt.preventDefault();
                evt.stopPropagation();
                return false;
            })
            .keydown(function (evt) {
                controler.keyDown(evt.originalEvent)
            })
            .keypress(function (evt) {
                controler.keyPress(evt.originalEvent);
            })
            .keyup(function (evt) {
                controler.keyUp(evt.originalEvent);
            });

        
        $(window).resize(() => this.renderer.resize());


    }

    click() {
        if(this.lockedOn) {
            this.lockedOn.click();
            return;
        }

        for (let i = 0; i < this.handlers.length; i++) {
            this.handlers[i].click();
        }
    }

    dblClick() {
        if(this.lockedOn) {
            this.lockedOn.dblClick();
            return;
        }
        
        for (let i = 0; i < this.handlers.length; i++) {
            this.handlers[i].dblClick();
        }
    }

    mouseDown(x, y) {
        if(this.lockedOn) {
            this.lockedOn.mouseDown(x, y);
            return;
        }
        
        for (let i = 0; i < this.handlers.length; i++) {
            this.handlers[i].mouseDown(x, y);
        }
    }

    mouseMove(x, y) {
        if(this.lockedOn) {
            this.lockedOn.mouseMove(x, y);
            return;
        }

        for (let i = 0; i < this.handlers.length; i++) {
            this.handlers[i].mouseMove(x, y);
        }
    }

    mouseUp(x, y) {
        if(this.lockedOn) {
            this.lockedOn.mouseUp(x, y);
            return;
        }

        for (let i = 0; i < this.handlers.length; i++) {
            this.handlers[i].mouseUp(x, y);
        }
    }

    mouseWheel(dx, dy) {
        if(this.lockedOn) {
            this.lockedOn.mouseWheel(dx, dy);
            return;
        }

        for (let i = 0; i < this.handlers.length; i++) {
            this.handlers[i].mouseWheel(dx, dy);
        }
    }

    keyDown(evt) {
        if(this.lockedOn) {
            this.lockedOn.keyDown(evt);
            return;
        }

        for (let i = 0; i < this.handlers.length; i++) {
            this.handlers[i].keyDown(evt);
        }
    }

    keyPress(evt) {
        if(this.lockedOn) {
            this.lockedOn.keyPress(evt);
            return;
        }

        for (let i = 0; i < this.handlers.length; i++) {
            this.handlers[i].keyPress(evt);
        }
    }

    keyUp(evt) {
        if(this.lockedOn) {
            this.lockedOn.keyUp(evt);
            return;
        }

        for (let i = 0; i < this.handlers.length; i++) {
            this.handlers[i].keyUp(evt);
        }
    }

    changeActiveSheet(index: number) {
        this.cellEditor.deselect();
        this.websheet.ActiveSheetIndex = index;
        this.cellEditor.select(false);
    }
}
