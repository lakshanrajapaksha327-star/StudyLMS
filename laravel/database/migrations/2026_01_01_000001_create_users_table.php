<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->enum('role', ['Student', 'Educator', 'Admin'])->default('Student');
            $table->enum('status', ['Active', 'Suspended'])->default('Active');
            $table->integer('study_goal_minutes')->default(60);
            $table->string('preferred_ai_model')->default('Gemini 2.5 Flash');
            $table->integer('study_streak_days')->default(1);
            $table->bigInteger('ai_tokens_consumed')->default(0);
            $table->rememberToken();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
