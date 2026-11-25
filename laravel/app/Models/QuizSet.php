<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuizSet extends Model
{
    use HasFactory;

    protected $fillable = [
        'notebook_id',
        'user_id',
        'title',
        'best_score',
        'questions_count',
        'last_taken_at',
    ];

    protected $casts = [
        'best_score' => 'integer',
        'questions_count' => 'integer',
        'last_taken_at' => 'datetime',
    ];

    public function notebook()
    {
        return $this->belongsTo(Notebook::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function questions()
    {
        return $this->hasMany(QuizQuestion::class);
    }
}
