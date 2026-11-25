<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FlashcardSet extends Model
{
    use HasFactory;

    protected $fillable = [
        'notebook_id',
        'user_id',
        'title',
        'mastery_percentage',
        'cards_count',
    ];

    protected $casts = [
        'mastery_percentage' => 'integer',
        'cards_count' => 'integer',
    ];

    public function notebook()
    {
        return $this->belongsTo(Notebook::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function cards()
    {
        return $this->hasMany(Flashcard::class);
    }
}
