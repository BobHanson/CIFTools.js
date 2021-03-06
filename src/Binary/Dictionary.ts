/*
 * Copyright (c) 2016 - now David Sehnal, licensed under MIT License, See LICENSE file for more info.
 */

namespace CIFTools.Binary {
    "use strict";

    export class File implements CIFTools.File {

        dataBlocks: DataBlock[];

        toJSON() {
            return this.dataBlocks.map(b => b.toJSON());
        }

        constructor(data: EncodedFile) {
            this.dataBlocks = data.dataBlocks.map(b => new DataBlock(b));
        }
    }

    export class DataBlock implements CIFTools.DataBlock {
        private categoryMap: Map<string, Category>;
        private categoryList: Category[];

        header: string;
        additionalData: { [name: string]: any } = {}
        get categories() { return this.categoryList; }
        getCategory(name: string) { return this.categoryMap.get(name); }

        toJSON() {
            return {
                id: this.header,
                categories: this.categoryList.map(c => c.toJSON()),
                additionalData: this.additionalData
            };
        }

        constructor(data: EncodedDataBlock) {
            this.header = data.header;
            this.categoryList = data.categories.map(c => new Category(c));
            this.categoryMap = new Map<string, Category>();
            for (let c of this.categoryList) {
                this.categoryMap.set(c.name, c);
            }
        }
    }

    export class Category implements CIFTools.Category {
        private encodedColumns: Map<string, EncodedColumn>;
        private columnNameList: string[];

        name: string;
        columnCount: number;
        rowCount: number;

        get columnNames() { return this.columnNameList; }

        getColumn(name: string): CIFTools.Column {
            let w = this.encodedColumns.get(name);
            if (w) return wrapColumn(w);
            return CIFTools.UndefinedColumn;
        }

        toJSON() {
            let rows: any[] = [];
            let columns = this.columnNameList.map(name => ({ name, column: this.getColumn(name) }));

            for (let i = 0; i < this.rowCount; i++) {
                let item: any = {};
                for (let c of columns) {
                    let d = c.column.getValuePresence(i);
                    if (d === ValuePresence.Present) item[c.name] = c.column.getString(i);
                    else if (d === ValuePresence.NotSpecified) item[c.name] = '.';
                    else item[c.name] = '?';
                }
                rows[i] = item;
            }
            return { name: this.name, columns: this.columnNames, rows };
        }

        constructor(data: EncodedCategory) {
            this.name = data.name;
            this.columnCount = data.columns.length;
            this.rowCount = data.rowCount;
            this.columnNameList = [];
            this.encodedColumns = new Map<string, EncodedColumn>();

            for (let c of data.columns) {
                this.encodedColumns.set(c.name, c);
                this.columnNameList.push(c.name);
            }
        }
    }

    function wrapColumn(column: EncodedColumn): Column {
        if (!column.data.data) return CIFTools.UndefinedColumn;
        let data = decode(column.data);
        let mask: Uint8Array | undefined = void 0;
        if (column.mask) mask = decode(column.mask);
        if (data.buffer && data.byteLength && data.BYTES_PER_ELEMENT) {
            return mask ? new MaskedNumericColumn(data, mask) : new NumericColumn(data);
        }
        return mask ? new MaskedStringColumn(data, mask) : new StringColumn(data);
    }

    import fastParseInt = CIFTools.Utils.FastNumberParsers.parseInt
    import fastParseFloat = CIFTools.Utils.FastNumberParsers.parseFloat

    class NumericColumn implements Column {
        isDefined = true;
        getString(row: number): string { return `${this.data[row]}`; }
        getInteger(row: number): number { return this.data[row] | 0; }
        getFloat(row: number): number { return 1.0 * this.data[row]; }
        stringEquals(row: number, value: string) { return this.data[row] === fastParseFloat(value, 0, value.length); }
        areValuesEqual(rowA: number, rowB: number) { return this.data[rowA] === this.data[rowB]; }
        getValuePresence(row: number) { return ValuePresence.Present; }
        constructor(private data: any) { }
    }

    class MaskedNumericColumn implements Column {
        isDefined = true;
        getString(row: number): string | null { return this.mask[row] === ValuePresence.Present ? `${this.data[row]}` : null; }
        getInteger(row: number): number { return this.mask[row] === ValuePresence.Present ? this.data[row] : 0; }
        getFloat(row: number): number { return this.mask[row] === ValuePresence.Present ? this.data[row] : 0; }
        stringEquals(row: number, value: string) { return this.mask[row] === ValuePresence.Present ? this.data[row] === fastParseFloat(value, 0, value.length) : value === null || value === void 0; }
        areValuesEqual(rowA: number, rowB: number) { return this.data[rowA] === this.data[rowB]; }
        getValuePresence(row: number): ValuePresence { return this.mask[row]; }
        constructor(private data: any, private mask: Uint8Array) { }
    }

    class StringColumn implements Column {
        isDefined = true;
        getString(row: number): string | null { return this.data[row]; }
        getInteger(row: number): number { let v = this.data[row]; return fastParseInt(v, 0, v.length); }
        getFloat(row: number): number { let v = this.data[row]; return fastParseFloat(v, 0, v.length); }
        stringEquals(row: number, value: string) { return this.data[row] === value; }
        areValuesEqual(rowA: number, rowB: number) { return this.data[rowA] === this.data[rowB]; }
        getValuePresence(row: number) { return ValuePresence.Present; }
        constructor(private data: string[]) { }
    }

    class MaskedStringColumn implements Column {
        isDefined = true;
        getString(row: number): string | null { return this.mask[row] === ValuePresence.Present ? this.data[row] : null; }
        getInteger(row: number): number { if (this.mask[row] !== ValuePresence.Present) return 0; let v = this.data[row]; return fastParseInt(v || '', 0, (v || '').length); }
        getFloat(row: number): number { if (this.mask[row] !== ValuePresence.Present) return 0; let v = this.data[row]; return fastParseFloat(v || '', 0, (v || '').length); }
        stringEquals(row: number, value: string) { return this.data[row] === value; }
        areValuesEqual(rowA: number, rowB: number) { return this.data[rowA] === this.data[rowB]; }
        getValuePresence(row: number): ValuePresence { return this.mask[row]; }
        constructor(private data: any, private mask: Uint8Array) { }
    }
}