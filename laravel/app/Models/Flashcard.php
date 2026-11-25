<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Flashcard extends Model
{
    use HasFactory;

    protected $fillable = [
        'flashcard_set_id',
        'question',
        'answer',
        'hint',
        'status', // 'new', 'learning', 'mastered'
        'last_reviewed_at',
    ];

    protected $casts = [
        'last_reviewed_at' => 'datetime',
    ];

    public function flashcardSet()
    {
        return $this->belongsTo(FlashcardSet::class);
    }
}
