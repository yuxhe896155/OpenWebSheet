import {Cell} from "./Cell";
import {Appearance, Border} from "./Appearance";
import {ColumnDefaultWidth, RowDefaultHeight, SheetTitleWidth} from "../common/constants";
import {Evaluator, IDateProvider} from "./formula/Evaluator";


export class CellSelection {
    public left: number;
    public top: number;
    public right: number;
    public bottom: number;

    public rowId: number;
    public columnId: number;

    public get single() {
        return this.right == this.left && this.top == this.bottom
    }

    public toString() {
        return `${this.top} ${this.left} - ${this.bottom} ${this.right}`;
    }
}

export class Sheet implements IDateProvider {

    private data: any[] = [];
    public defaultAppearance: Appearance = new Appearance();
    public defaultRowHeight = 30;
    public defaultColumnWidth = 100;
    private appearance: any[] = [];
    private columnAppearance: Appearance[] = [];
    private rowAppearance: Appearance[] = [];
    private rowHeight: number[] = [];
    private columnWidth: number[] = []
    private scrollX: number = 0;
    private scrollY: number = 0;
    public selection: CellSelection;
    private change_listeners = [];

    constructor(public title: string) {
        this.defaultAppearance.background = null;
        this.defaultAppearance.fontName = 'lato';
        this.defaultAppearance.fontSize = 12;
        this.defaultAppearance.horizontalBorder = null;
        this.defaultAppearance.verticalBorder = null;
        this.defaultAppearance.text = '#444444';


        this.selection = new CellSelection();
        this.selection.top = 0;
        this.selection.left = 0;
        this.selection.right = 0;
        this.selection.bottom = 0;
        this.selection.rowId = 0;
        this.selection.columnId = 0;
    }

    selectNextColumnCell() {
        this.selection.columnId++;

        if (this.selection.single) {
            this.selection.right = this.selection.columnId;
            this.selection.left = this.selection.columnId;
            this.onChange();
            return;
        }

        if (this.selection.columnId > this.selection.right) {
            this.selection.columnId = this.selection.left;
            if (this.selection.rowId == this.selection.bottom) {
                this.selection.rowId = this.selection.top;
            } else {
                this.selectNextRowCell();
            }

        }

        if (this.invalidSelection) this.selectNextColumnCell();
        this.onChange();
    }

    private getCellName(columnId, rowId) {
        return `${Sheet.get_columnName(columnId)}${ rowId + 1 }`;
    }

    public get SelectionLabel() {
        return this.getCellName(this.selection.columnId, this.selection.rowId);
    }

    public get SelectedValue() {
        return this.selectedCell && this.selectedCell.value;
    }

    public get SelectedAppearance() {
        return this.getAppearance(this.selection.columnId, this.selection.rowId);
    }

    selectPreviousColumnCell() {
        if (this.selection.columnId == 0) return;
        this.selection.columnId--;

        if (this.selection.single) {
            this.selection.right = this.selection.columnId;
            this.selection.left = this.selection.columnId;
            this.onChange();
            return;
        }

        if (this.selection.columnId < this.selection.left) {
            this.selection.columnId = this.selection.right;
            if (this.selection.rowId == this.selection.top) {
                this.selection.rowId = this.selection.bottom;
            } else {
                this.selectPreviousRowCell();
            }
        }

        if (this.invalidSelection) this.selectPreviousColumnCell();
        this.onChange();
    }

    get selectedCell() {
        return this.getCell(this.selection.columnId, this.selection.rowId);
    }

    private get invalidSelection() {
        return this.selectedCell && this.selectedCell.isMerged;
    }

    selectNextRowCell() {

        this.selection.rowId++;
        if (this.selection.single) {
            this.selection.top = this.selection.rowId;
            this.selection.bottom = this.selection.rowId;
            this.onChange();
            return;
        }

        if (this.selection.rowId > this.selection.bottom) {
            this.selection.rowId = this.selection.top;
            if (this.selection.columnId == this.selection.right) {
                this.selection.columnId = this.selection.left;
            } else {
                this.selectNextColumnCell();
            }
        }

        if (this.invalidSelection) this.selectNextRowCell();
        this.onChange();
    }

    selectPreviousRowCell() {
        if (this.selection.rowId == 0) return;
        this.selection.rowId--;
        if (this.selection.single) {
            this.selection.top = this.selection.rowId;
            this.selection.bottom = this.selection.rowId;
            this.onChange();
            return;
        }

        if (this.selection.rowId < this.selection.top) {
            this.selection.rowId = this.selection.bottom;
            if (this.selection.columnId == this.selection.left) {
                this.selection.columnId = this.selection.right;
            } else {
                this.selectPreviousColumnCell();
            }
        }

        if (this.invalidSelection) this.selectPreviousRowCell();
        this.onChange();
    }

    private getCellPos(name) {
        const regex = /([a-zA-z]+)([0-9]+)/g;
        if (!(/([a-zA-z]+)([0-9]+)/g).test(name)) {
            throw 'invalid cell name ' + name;
        }
        const pos = regex.exec(name);
        const columnId = this.getColumnIndex(pos[1]);
        const rowId = parseInt(pos[2]) - 1;

        return {rowId: rowId, columnId: columnId};
    }

    getEvaluatedValue(exp) {
        if (('' + exp).indexOf(':') != -1) {
            const parts = exp.split(':');
            const a = this.getCellPos(parts[0]);
            const b = this.getCellPos(parts[1]);
            let res = [];
            for (let c = a.columnId; c <= b.columnId; c++) {
                for (let r = a.rowId; r <= b.rowId; r++) {
                    res.push(this.getCellEvaluatedValue(c, r));
                }
            }
            return res;
        }

        let {rowId, columnId} = this.getCellPos(exp);
        return this.getCellEvaluatedValue(columnId, rowId);
    }

    private getColumnIndex(name) {
        let sum = 0;
        let pwr = 1;
        let st = 65;
        for (let i = name.length - 1; i >= 0; i--) {
            const ch = name.charCodeAt(i) - st;
            sum += ch * pwr;
            pwr *= 26;
            st = 64;
        }
        return sum;
    }

    private getCellEvaluatedValue(columnId, rowId) {
        const cell = this.getCell(columnId, rowId);
        if (cell == null) {
            return null;
        }

        return Evaluator.Eval(this, cell.value);//TODO: should be cached and check cycles

    }

    removeCell (columnId: number, rowId: number) {
        if(this.data[columnId] && this.data[columnId][rowId]) {
            this.data[columnId][rowId] = undefined;
        }
    }

    setCellValue(columnId: number, rowId: number, value, silent = false): any {
        if(value == null) {
            this.removeCell(columnId,rowId);
            return;
        }
        let cell = this.forceGetCell(columnId, rowId);
        if (value.startsWith('=')) {
            let evaluatedValue = Evaluator.Eval(this, value);
            cell.update(value, evaluatedValue);
        } else {
            cell.value = value;
        }
        if (!silent) {
            this.updateDependees(columnId, rowId);
            this.onChange()
        }
    }

    private updateDependees(columnId: number, rowId: number) {
        //TODO:bad performance
        for (let d of this.data) {
            if (!d) continue;
            for (let c of d) {
                if (!c || !c.value) continue;
                if (c.value.length && c.value[0] == '=') {
                    this.setCellValue(c.columnId, c.rowId, c.value, true)
                }
            }
        }
    }

    getColumnLeft(columnId: number) {
        let result = 0;
        for (let i = this.scrollColumn; i < columnId; i++) {
            result += this.getColumnWidth(i);
        }
        return result;
    }

    getColumnRight(columnId: number) {
        return this.getColumnLeft(columnId) + this.getColumnWidth(columnId);
    }

    getRowTop(rowId: number) {
        let result = 0;
        for (let i = this.scrollRow; i < rowId; i++) {
            result += this.getRowHeight(i);
        }
        return result;
    }

    getRowBottom(rowId: number) {
        return this.getRowTop(rowId) + this.getRowHeight(rowId);
    }

    findColumnIdByX(x) {
        if (x < 0) return 0;
        let colX = 0;
        for (let colId = this.scrollColumn; ; colId++) {
            if (colId > this.scrollColumn + 100) return 0;
            let colW = this.getColumnWidth(colId);
            if (x > colX && x < colX + colW) {
                return colId;
            }
            colX += colW;
        }
    }

    findRowIdByY(y) {
        let rowY = this.getRowHeight(this.scrollRow);
        let rowId = this.scrollRow;
        while (rowY < y) {
            rowId++;
            rowY += this.getRowHeight(rowId);
        }
        return rowId;
    }


    findCellByXY(x, y) {
        let colId = this.findColumnIdByX(x);
        let rowId = this.findRowIdByY(y);
        return this.getCell(colId, rowId);
    }


    public selectByXY(x1: number, y1: number, x2: number, y2: number): any {
        let top = Math.min(y1, y2);
        let left = Math.min(x1, x2);
        let right = Math.max(x1, x2);
        let bottom = Math.max(y1, y2);

        let stop = this.findRowIdByY(top);
        let sbottom = this.findRowIdByY(bottom);
        let sleft = this.findColumnIdByX(left);
        let sright = this.findColumnIdByX(right);
        let rowId = this.findRowIdByY(y1);
        let columnId = this.findColumnIdByX(x1);
        let selectedCell = this.getCell(columnId, rowId);
        if (selectedCell && selectedCell.isMerged) {
            rowId = selectedCell.reference.rowId;
            columnId = selectedCell.reference.columnId;
        }

        let ftop = stop;
        let fbottom = sbottom + 1;
        let fleft = sleft;
        let fright = sright + 1;

        for (let x = sleft; x <= sright; x++) {
            for (let y = stop; y <= sbottom; y++) {
                let cell = this.getCell(x, y);
                if (cell) {
                    ftop = Math.min(ftop, cell.top)
                    fleft = Math.min(fleft, cell.left)
                    fbottom = Math.max(fbottom, cell.bottom)
                    fright = Math.max(fright, cell.right)
                }
            }
        }

        this.selection.top = ftop;
        this.selection.left = fleft;
        this.selection.right = fright - 1;
        this.selection.bottom = fbottom - 1;
        this.selection.rowId = rowId;
        this.selection.columnId = columnId;
        this.onChange();
    }

    public scrollDown(): any {
        this.scroll(this.scrollColumn, this.scrollRow + 1);
    }

    public scrollUp(): any {
        this.scroll(this.scrollColumn, this.scrollRow - 1);
    }

    public scrollLeft(): any {
        this.scroll(this.scrollColumn + 1, this.scrollRow);
    }

    public scrollRight(): any {
        this.scroll(this.scrollColumn - 1, this.scrollRow);
    }

    public getCellHeight(cell: Cell): number {
        let height = 0;
        for (let i = cell.rowId; i < cell.rowId + cell.rowSpan; i++) {
            height += this.getRowHeight(i);
        }
        return height;
    }

    public getCellWidth(cell: Cell): number {
        let width = 0;
        for (let i = cell.columnId; i < cell.columnId + cell.colSpan; i++) {
            width += this.getColumnWidth(i);
        }
        return width;
    }

    public scroll(columnId, rowId) {
        if (columnId < 0) return;
        if (rowId < 0) return;
        for (let x in this.data) {
            for (let y in this.data[x]) {
                let cell: Cell = this.data[x][y];
                if (cell.columnId < parseInt(x)) {
                    columnId = cell.columnId + cell.colSpan;
                }
                if (cell.rowId < parseInt(y)) {
                    rowId = cell.rowId + cell.rowSpan;
                }
            }
        }

        this.scrollX = columnId;
        this.scrollY = rowId;

        this.onChange();
    }

    public merge(columnId: number, rowId: number, width: number, height: number) {
        let cell = this.forceGetCell(columnId, rowId);
        cell.colSpan = width;
        cell.rowSpan = height;
        this.setCell(columnId, rowId, cell);

        for (let x = columnId; x < columnId + width; x++) {
            for (let y = rowId; y < rowId + height; y++) {
                if (y != rowId || x != columnId) {
                    let xcell = this.forceGetCell(x, y);
                    xcell.reference = cell;
                    this.setCell(x, y, xcell);
                }
            }
        }

        this.onChange();
    }

    public unmerge(columnId: number, rowId: number) {
        let cell = this.getCell(columnId, rowId);
        if (!cell || (cell.rowSpan == 1 && cell.colSpan == 1)) return;

        for (let i = 0; i < cell.colSpan; i++) {
            for (let j = 0; j < cell.rowSpan; j++) {
                let cx = this.getCell(i + columnId, j + rowId);
                if (!cx) continue;
                cx.reference = null;
                this.setCell(i + columnId, j + rowId, cx, true);
            }
        }

        cell.rowSpan = 1;
        cell.colSpan = 1;
        this.setCell(columnId, rowId, cell, true)
        this.onChange();

    }

    public get scrollColumn() {
        return this.scrollX;
    }

    public get scrollRow() {
        return this.scrollY;
    }

    public forceGetCell(columnId: number, rowId: number) {
        let cell = this.getCell(columnId, rowId);
        if (!cell) {
            cell = new Cell(columnId, rowId);
            this.setCell(columnId, rowId, cell);
        }

        return cell;
    }

    public getCell(columnId: number, rowId: number): Cell {
        if (!this.data[columnId] || !this.data[columnId][rowId]) {
            return null;
        }

        return this.data[columnId][rowId];
    }

    public setCell(columnId: number, rowId: number, cell: Cell, silent = false) {
        if (!this.data[columnId]) {
            this.data[columnId] = []
        }

        this.data[columnId][rowId] = cell;
        if (!silent) this.onChange();
    }


    public getColumnAppearance(columnId: number): Appearance {
        return this.columnAppearance[columnId];
    }

    public getRowAppearance(rowId: number): Appearance {
        return this.rowAppearance[rowId];
    }

    public getCellAppearance(columnId: number, rowId: number): Appearance {
        if (!this.appearance[columnId] || !this.appearance[columnId][rowId]) {
            return null;
        }

        return this.appearance[columnId][rowId];
    }

    public setCellAppearance(columnId: number, rowId: number, appearance: Appearance, silent = false) {
        if (!this.appearance[columnId]) {
            this.appearance[columnId] = [];
        }

        this.appearance[columnId][rowId] = appearance;
        if (!silent) this.onChange();
    }

    public setColumAppearance(columnId: number, Appearance: Appearance) {
        this.columnAppearance[columnId] = Appearance;
        this.onChange();
    }

    public setRowAppearance(rowId: number, Appearance: Appearance) {
        this.rowAppearance[rowId] = Appearance;
        this.onChange();
    }

    public getRowHeight(rowId): number {
        return this.rowHeight[rowId] || this.defaultRowHeight;
    }

    public setRowHeight(row, height) {
        this.rowHeight[row] = height;
        this.onChange();
    }

    public getColumnWidth(columnId): number {
        return this.columnWidth[columnId] || this.defaultColumnWidth;
    }

    public setColumnWidth(column, width): any {
        this.columnWidth[column] = width;
        this.onChange();
    }

    public getAppearance(columnId: number, rowId: number): Appearance {
        let appearance = new Appearance();

        let cell = this.getCellAppearance(columnId, rowId);
        let col = this.getColumnAppearance(columnId);
        let row = this.getRowAppearance(rowId);
        let def = this.defaultAppearance;

        appearance.background = (cell && cell.background) || (col && col.background) || (row && row.background) || def.background;
        appearance.fontName = (cell && cell.fontName) || (col && col.fontName) || (row && row.fontName) || def.fontName;
        appearance.fontSize = (cell && cell.fontSize) || (col && col.fontSize) || (row && row.fontSize) || def.fontSize;
        appearance.horizontalBorder = (cell && cell.horizontalBorder) || (col && col.horizontalBorder) || (row && row.horizontalBorder) || def.horizontalBorder;
        appearance.verticalBorder = (cell && cell.verticalBorder) || (col && col.verticalBorder) || (row && row.verticalBorder) || def.verticalBorder;
        appearance.text = (cell && cell.text) || (col && col.text) || (row && row.text) || def.text;
        appearance.textAlign = (cell && cell.textAlign) || (col && col.textAlign) || (row && row.textAlign) || def.textAlign;
        appearance.textStyle = (cell && cell.textStyle) || (col && col.textStyle) || (row && row.textStyle) || def.textStyle;

        return appearance;

    }

    public static get_columnName(column) {
        let az = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let columnString = "";
        let columnNumber = column + 1;
        while (columnNumber > 0) {
            let currentLetterNumber = (columnNumber - 1) % 26;
            let currentLetter = az[currentLetterNumber];
            columnString = currentLetter + columnString;
            columnNumber = (columnNumber - (currentLetterNumber + 1)) / 26;
        }
        return columnString;
    }

    private onChange() {
        this.change_listeners.forEach(m => m());
    }

    public addOnChange(handler: () => void) {
        this.change_listeners.push(handler);
    }

    public removeOnChange(handler: () => void) {
        let ix = this.change_listeners.indexOf(handler);
        if (ix >= 0) {
            this.change_listeners.splice(ix, 1);
        }
    }

    public getWidth(measure: (text: string) => number) {
        return SheetTitleWidth;
        //return Math.max(SheetTitleWidth, measure(this.title) + 10); TODO: use this
    }

    save() {
        return {
            title: this.title,
            data: this.data,
            appearance: this.appearance,
            columnAppearance: this.columnAppearance,
            rowAppearance: this.rowAppearance,
            rowHeight: this.rowHeight,
            columnWidth: this.columnWidth,
            scrollX: this.scrollX,
            scrollY: this.scrollY,
            selection: this.selection
        }
    }

    private fill(data) {
        this.data = [];
        for (let d of data) {
            if (!d) continue;
            for (let c of d) {
                if (!c) continue;
                let cell = Cell.from(c);
                this.setCell(cell.columnId, cell.rowId, cell, true);
            }
        }
    }

    private style(app) {
        this.appearance = [];
        if (!app) return;
        for (let d of app) {
            if (!d) continue;
            for (let c of d) {
                if (!c) continue;
                let a = Appearance.from(c);
                const col = app.indexOf(d);
                const row = d.indexOf(c);
                this.setCellAppearance(col, row, a, true);
            }
        }
    }

    static load(sheet): Sheet {
        let sh = new Sheet(sheet.title);
        sh.fill(sheet.data);
        sh.style(sheet.appearance);
        sh.columnAppearance = sheet.columnAppearance;
        sh.rowAppearance = sheet.rowAppearance;
        sh.columnWidth = sheet.columnWidth;
        sh.rowHeight = sheet.rowHeight;
        sh.scrollX = sheet.scrollX;
        sh.scrollY = sheet.scrollY;
        sh.selection = sheet.selection;

        return sh;
    }
}