/*
 * Copyright (c) 2016 - now David Sehnal, licensed under MIT License, See LICENSE file for more info.
 */

namespace CIFTools.Binary {
    "use strict";

    /**
     * Fixed point, delta, RLE, integer packing adopted from https://github.com/rcsb/mmtf-javascript/
     * by Alexander Rose <alexander.rose@weirdbyte.de>, MIT License, Copyright (c) 2016
     */

    export function decode(data: EncodedData): any {
        let current = data.data;
        for (let i = data.encoding.length - 1; i >= 0; i--) {
            current = Decoder.decodeStep(current, data.encoding[i]);
        }
        return current;
    }

    namespace Decoder {

        export function decodeStep(data: any, encoding: Encoding): any {
            switch (encoding.kind) {
                case 'ByteArray': {
                    switch (encoding.type) {
                        case Encoding.IntDataType.Uint8: return data;
                        case Encoding.IntDataType.Int8: return int8(data);
                        case Encoding.IntDataType.Int16: return int16(data);
                        case Encoding.IntDataType.Uint16: return uint16(data);
                        case Encoding.IntDataType.Int32: return int32(data);
                        case Encoding.IntDataType.Uint32: return uint32(data);
                        case Encoding.FloatDataType.Float32: return float32(data);
                        case Encoding.FloatDataType.Float64: return float64(data);
                        default: throw new Error('Unsupported ByteArray type.')
                    }
                }
                case 'FixedPoint': return fixedPoint(data, encoding);
                case 'IntervalQuantization': return intervalQuantization(data, encoding);
                case 'RunLength': return runLength(data, encoding);
                case 'Delta': return delta(data, encoding);
                case 'IntegerPacking': return integerPacking(data, encoding);
                case 'StringArray': return stringArray(data, encoding);
            }
        }

        function getIntArray(type: Encoding.IntDataType, size: number) {
            switch (type) {
                case Encoding.IntDataType.Int8: return new Int8Array(size);
                case Encoding.IntDataType.Int16: return new Int16Array(size);
                case Encoding.IntDataType.Int32: return new Int32Array(size);
                case Encoding.IntDataType.Uint8: return new Uint8Array(size);
                case Encoding.IntDataType.Uint16: return new Uint16Array(size);
                case Encoding.IntDataType.Uint32: return new Uint32Array(size);
                default: throw new Error('Unsupported integer data type.');
            }
        }

        function getFloatArray(type: Encoding.FloatDataType, size: number) {
            switch (type) {
                case Encoding.FloatDataType.Float32: return new Float32Array(size);
                case Encoding.FloatDataType.Float64: return new Float64Array(size);
                default: throw new Error('Unsupported floating data type.');
            }
        }

        /* http://stackoverflow.com/questions/7869752/javascript-typed-arrays-and-endianness */
        const isLittleEndian = (function() {
            var arrayBuffer = new ArrayBuffer(2);
            var uint8Array = new Uint8Array(arrayBuffer);
            var uint16array = new Uint16Array(arrayBuffer);
            uint8Array[0] = 0xAA; 
            uint8Array[1] = 0xBB; 
            if(uint16array[0] === 0xBBAA) return true;
            return false;
        })();

        function int8(data: Uint8Array) { return new Int8Array(data.buffer, data.byteOffset); }

        function flipByteOrder(data: Uint8Array, bytes: number) {
            let buffer = new ArrayBuffer(data.length);
            let ret = new Uint8Array(buffer);
            for (let i = 0, n = data.length; i < n; i += bytes) {
                for (let j = 0; j < bytes; j++) { 
                    ret[i + bytes - j - 1] = data[i + j];
                }
            }
            return buffer;
        }

        function view<T>(data: Uint8Array, byteSize: number, c: new(buffer: ArrayBuffer) => T) {
            if (isLittleEndian) return new c(data.buffer);
            return new c(flipByteOrder(data, byteSize));
        }

        function int16(data: Uint8Array) { return view(data, 2, Int16Array); }
        function uint16(data: Uint8Array) { return view(data, 2, Uint16Array); }
        function int32(data: Uint8Array) { return view(data, 4, Int32Array); }
        function uint32(data: Uint8Array) { return view(data, 4, Uint32Array); }
        function float32(data: Uint8Array) { return view(data, 4, Float32Array); }
        function float64(data: Uint8Array) { return view(data, 8, Float64Array); }

        function fixedPoint(data: Int32Array, encoding: Encoding.FixedPoint) {
            let n = data.length;
            let output = getFloatArray(encoding.srcType, n);
            let f = 1 / encoding.factor;
            for (let i = 0; i < n; i++) {
                output[i] = f * data[i];
            }
            return output;
        }

        function intervalQuantization(data: Int32Array, encoding: Encoding.IntervalQuantization) {
            let n = data.length;
            let output = getFloatArray(encoding.srcType, n);
            let delta = (encoding.max - encoding.min) / (encoding.numSteps - 1)
            let min = encoding.min;
            for (let i = 0; i < n; i++) {
                output[i] = min + delta * data[i];
            }
            return output;
        }

        function runLength(data: Int32Array, encoding: Encoding.RunLength) {
            let output = getIntArray(encoding.srcType, encoding.srcSize);
            let dataOffset = 0;
            for (let i = 0, il = data.length; i < il; i += 2) {
                let value = data[i];  // value to be repeated
                let length = data[i + 1];  // number of repeats
                for (let j = 0; j < length; ++j) {
                    output[dataOffset++] = value;
                }
            }
            return output;
        }

        function delta(data: (Int8Array | Int16Array | Int32Array), encoding: Encoding.Delta) {
            let n = data.length;
            let output = getIntArray(encoding.srcType, n);
            if (!n) return output;
            output[0] = data[0] + (encoding.origin | 0);
            for (let i = 1; i < n; ++i) {
                output[i] = data[i] + output[i - 1];
            }
            return output;
        }

        function integerPackingSigned(data: (Int8Array | Int16Array), encoding: Encoding.IntegerPacking) {
            let upperLimit = encoding.byteCount === 1 ? 0x7F : 0x7FFF;
            let lowerLimit = -upperLimit - 1;
            let n = data.length;
            let output = new Int32Array(encoding.srcSize);
            let i = 0;
            let j = 0;
            while (i < n) {
                let value = 0, t = data[i];
                while (t === upperLimit || t === lowerLimit) {
                    value += t;
                    i++;
                    t = data[i];
                }
                value += t;
                output[j] = value;
                i++;
                j++;
            }
            return output;
        }

        function integerPackingUnsigned(data: (Int8Array | Int16Array), encoding: Encoding.IntegerPacking) {
            let upperLimit = encoding.byteCount === 1 ? 0xFF : 0xFFFF;
            let n = data.length;
            let output = new Int32Array(encoding.srcSize);
            let i = 0;
            let j = 0;
            while (i < n) {
                let value = 0, t = data[i];
                while (t === upperLimit) {
                    value += t;
                    i++;
                    t = data[i];
                }
                value += t;
                output[j] = value;
                i++;
                j++;
            }
            return output;
        }

        function integerPacking(data: (Int8Array | Int16Array), encoding: Encoding.IntegerPacking) {
            return encoding.isUnsigned ? integerPackingUnsigned(data, encoding) : integerPackingSigned(data, encoding);
        }

        function stringArray(data: Uint8Array, encoding: Encoding.StringArray) {
            let str = encoding.stringData;
            let offsets = decode({ encoding: encoding.offsetEncoding, data: encoding.offsets });
            let indices = decode({ encoding: encoding.dataEncoding, data });
            let cache: any = Object.create(null);
            let result = new Array(indices.length);
            let offset = 0;
            for (let i of indices) {
                if (i < 0) {
                    result[offset++] = null;
                    continue;
                }
                let v = cache[i];
                if (v === void 0) {
                    v = str.substring(offsets[i], offsets[i + 1]);
                    cache[i] = v;
                }
                result[offset++] = v;
            }
            return result;
        }
    }
}