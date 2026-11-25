<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuizQuestion extends Model
{
    use HasFactory;

    protected $fillable = [
        'quiz_set_id',
        'type', // 'multiple-choice', 'true-false', 'short-answer'
        'question',
        'options',
        'correct_answer',
        'explanation',
    ];

    protected $casts = [
        'options' => 'array',
    ];

    public function quizSet()
    {
        return $this->belongsTo(QuizSet::class);
    }
}
