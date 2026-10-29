<?php

// Validasi input sederhana. Aturan dipisah "|", contoh: 'required|int|min:1'.
// Aturan yang didukung: required, string, int, numeric, bool, date, datetime, max:N, min:N, in:a,b,c
class Validator
{
    public static function validate(array $data, array $rules, bool $partial = false): array
    {
        $errors = [];
        $clean = [];

        foreach ($rules as $field => $ruleStr) {
            $rules_ = explode('|', $ruleStr);
            $ada = array_key_exists($field, $data) && $data[$field] !== '' && $data[$field] !== null;

            if (!$ada) {
                // Mode partial (PUT/PATCH): field yang tidak dikirim tidak diubah
                if (in_array('required', $rules_, true) && !$partial) {
                    $errors[$field] = 'Wajib diisi';
                } elseif (array_key_exists($field, $data)) {
                    $clean[$field] = null; // dikirim kosong -> set NULL
                }
                continue;
            }

            $v = is_string($data[$field]) ? trim($data[$field]) : $data[$field];
            $err = null;

            foreach ($rules_ as $rule) {
                [$nama, $arg] = array_pad(explode(':', $rule, 2), 2, null);
                switch ($nama) {
                    case 'string':
                        if (!is_string($v)) $err = 'Harus berupa teks';
                        break;
                    case 'int':
                        if (filter_var($v, FILTER_VALIDATE_INT) === false) $err = 'Harus bilangan bulat';
                        else $v = (int) $v;
                        break;
                    case 'numeric':
                        if (!is_numeric($v)) $err = 'Harus berupa angka';
                        else $v = $v + 0;
                        break;
                    case 'bool':
                        $b = filter_var($v, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                        if ($b === null) $err = 'Harus true/false';
                        else $v = $b;
                        break;
                    case 'date':
                        $d = DateTime::createFromFormat('!Y-m-d', (string) $v);
                        if (!$d || $d->format('Y-m-d') !== $v) $err = 'Format tanggal YYYY-MM-DD';
                        break;
                    case 'datetime':
                        if (strtotime((string) $v) === false) $err = 'Format tanggal-waktu tidak valid';
                        break;
                    case 'max':
                        if (is_string($v) && mb_strlen($v) > (int) $arg) $err = "Maksimal $arg karakter";
                        elseif (!is_string($v) && $v > $arg) $err = "Maksimal $arg";
                        break;
                    case 'min':
                        if (!is_string($v) && $v < $arg) $err = "Minimal $arg";
                        break;
                    case 'in':
                        if (!in_array($v, explode(',', $arg), true)) $err = "Pilihan: $arg";
                        break;
                }
                if ($err) break;
            }

            if ($err) {
                $errors[$field] = $err;
            } else {
                $clean[$field] = $v;
            }
        }

        return $errors ? Response::invalid($errors) : $clean;
    }

    /** Pastikan input berupa array id (misal fasilitas_ids: [1,2,3]). */
    public static function idList($value, string $field): array
    {
        if ($value === null || $value === '') {
            return [];
        }
        if (!is_array($value)) {
            Response::invalid([$field => 'Harus berupa array id']);
        }
        $ids = [];
        foreach ($value as $v) {
            if (filter_var($v, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false) {
                Response::invalid([$field => 'Berisi id yang tidak valid']);
            }
            $ids[] = (int) $v;
        }
        return array_values(array_unique($ids));
    }
}
