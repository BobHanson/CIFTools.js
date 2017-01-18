/*
 * Copyright (c) 2016 - now David Sehnal, licensed under MIT License, See LICENSE file for more info.
 */

namespace CIFTools.Binary {
    "use strict";

    export const VERSION = '0.3.0';

    export type Encoding = 
          Encoding.ByteArray 
        | Encoding.FixedPoint 
        | Encoding.RunLength 
        | Encoding.Delta 
        | Encoding.IntervalQuantization
        | Encoding.IntegerPacking 
        | Encoding.StringArray;

    export interface EncodedFile {
        version: string,
        encoder: string,
        dataBlocks: EncodedDataBlock[]
    }

    export interface EncodedDataBlock {
        header: string,
        categories: EncodedCategory[],
    }

    export interface EncodedCategory {
        name: string,
        rowCount: number,
        columns: EncodedColumn[],
    }

    export interface EncodedColumn {
        name: string,
        data: EncodedData,

        /**
         * The mask represents the presence or absent of particular "CIF value".
         * If the mask is not set, every value is present.
         * 
         * 0 = Value is present
         * 1 = . = value not specified
         * 2 = ? = value unknown
         */
        mask?: EncodedData
    }

    export interface EncodedData {
        encoding: Encoding[],
        data: Uint8Array
    }

    export namespace Encoding {

        export const enum IntDataType {
            Int8    = 1,
            Int16   = 2,
            Int32   = 3,
            Uint8   = 4,
            Uint16  = 5,
            Uint32  = 6,
        }

        export const enum FloatDataType {
            Float32 = 32,
            Float64 = 33
        }

        export type DataType = IntDataType | FloatDataType

        export type IntArray = Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array
        export type FloatArray = Float32Array | Float64Array

        export function getDataType(data: IntArray | FloatArray): DataType {
            let srcType: DataType;
            if (data instanceof Int8Array) srcType = Encoding.IntDataType.Int8;
            else if (data instanceof Int16Array) srcType = Encoding.IntDataType.Int16;
            else if (data instanceof Int32Array) srcType = Encoding.IntDataType.Int32;
            else if (data instanceof Uint8Array) srcType = Encoding.IntDataType.Uint8;
            else if (data instanceof Uint16Array) srcType = Encoding.IntDataType.Uint16;
            else if (data instanceof Uint32Array) srcType = Encoding.IntDataType.Uint32;
            else if (data instanceof Float32Array) srcType = Encoding.FloatDataType.Float32;
            else if (data instanceof Float64Array) srcType = Encoding.FloatDataType.Float64;
            else throw new Error('Unsupported integer data type.');
            return srcType;
        }

        export function isSignedIntegerDataType(data: IntArray) {
            return data instanceof Int8Array || data instanceof Int16Array || data instanceof Int32Array;
        }

        // type[] -> Uint8[]
        export interface ByteArray {
            kind: 'ByteArray',
            type: DataType
        }

        // (Float32 | Float64)[] -> Int32[]
        export interface FixedPoint {
            kind: 'FixedPoint',
            factor: number,
            srcType: FloatDataType
        }

        // (Float32|Float64)[] -> Int32
        export interface IntervalQuantization {
            kind: 'IntervalQuantization',
            min: number,
            max: number,
            numSteps: number,
            srcType: FloatDataType
        }

        // (Uint8 | Int8 | Int16 | Int32)[] -> Int32[]
        export interface RunLength {
            kind: 'RunLength',
            srcType: IntDataType,
            srcSize: number
        }

        // T=(Int8Array | Int16Array | Int32Array)[] -> T[]
        export interface Delta {
            kind: 'Delta',
            origin: number,
            srcType: IntDataType
        }

        // Int32[] -> (Int8 | Int16 | Uint8 | Uint16)[]
        export interface IntegerPacking {
            kind: 'IntegerPacking',
            byteCount: number,
            isUnsigned: boolean,
            srcSize: number
        }

        // string[] -> Uint8[]
        // stores 0 and indices of ends of strings:
        // stringData = '123456'
        // offsets = [0,2,5,6]
        // encodes ['12','345','6']
        export interface StringArray {
            kind: 'StringArray',
            dataEncoding: Encoding[],
            stringData: string,
            offsetEncoding: Encoding[],
            offsets: Uint8Array
        }

    }
}