<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Note extends Model
{
    use HasFactory;

    protected $fillable = [
        'notebook_id',
        'user_id',
        'title',
        'content',
        'tags',
        'ai_summary',
    ];

    protected $casts = [
        'tags' => 'array',
    ];

    public function notebook()
    {
        return $this->belongsTo(Notebook::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
