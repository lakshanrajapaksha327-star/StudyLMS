<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role', // 'Student', 'Educator', 'Admin'
        'status', // 'Active', 'Suspended'
        'study_goal_minutes',
        'preferred_ai_model',
        'study_streak_days',
        'ai_tokens_consumed',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'study_goal_minutes' => 'integer',
        'study_streak_days' => 'integer',
        'ai_tokens_consumed' => 'integer',
    ];

    public function notebooks()
    {
        return $this->hasMany(Notebook::class);
    }

    public function notes()
    {
        return $this->hasMany(Note::class);
    }

    public function flashcardSets()
    {
        return $this->hasMany(FlashcardSet::class);
    }

    public function quizSets()
    {
        return $this->hasMany(QuizSet::class);
    }
}
