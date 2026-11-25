<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flashcard_sets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('notebook_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('title');
            $table->integer('mastery_percentage')->default(0);
            $table->integer('cards_count')->default(0);
            $table->timestamps();
        });

        Schema::create('flashcards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('flashcard_set_id')->constrained()->onDelete('cascade');
            $table->text('question');
            $table->text('answer');
            $table->string('hint')->nullable();
            $table->enum('status', ['new', 'learning', 'mastered'])->default('new');
            $table->timestamp('last_reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flashcards');
        Schema::dropIfExists('flashcard_sets');
    }
};
