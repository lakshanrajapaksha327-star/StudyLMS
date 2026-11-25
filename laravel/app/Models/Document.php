<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    use HasFactory;

    protected $fillable = [
        'notebook_id',
        'title',
        'type', // 'pdf', 'text', 'markdown', 'pasted'
        'content',
        'summary',
        'key_concepts',
        'file_path',
        'file_size',
    ];

    protected $casts = [
        'key_concepts' => 'array',
        'file_size' => 'integer',
    ];

    public function notebook()
    {
        return $this->belongsTo(Notebook::class);
    }
}
