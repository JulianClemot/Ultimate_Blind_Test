import type { GameEventPublisher } from '../../../application';
import type { Answer, Game, Player, Song } from '../../../domain';
import {
  toAnswerDto,
  toHostSongDto,
  toPlayerDto,
  toPublicScoreboard,
  toRevealDto,
  toSongDto,
} from '../../mappers/dtoMappers';
import { rooms } from '../../realtime/rooms';
import type { GameServer } from '../../realtime/types';

export class SocketIoGameEventPublisher implements GameEventPublisher {
  constructor(private readonly io: GameServer) {}

  playerJoined(game: Game, player: Player): void {
    this.io.to(rooms.hosts(game.id)).emit('player:joined', toPlayerDto(player));
  }

  songStarted(game: Game, song: Song): void {
    this.io
      .to(rooms.game(game.id))
      .except(rooms.hosts(game.id))
      .emit('song:started', toSongDto(game, song));
    this.io.to(rooms.hosts(game.id)).emit('host:song-started', toHostSongDto(game, song));
  }

  answerReceived(game: Game, answer: Answer): void {
    this.io.to(rooms.hosts(game.id)).emit('answer:received', toAnswerDto(game, answer));
  }

  answerJudged(game: Game, answer: Answer): void {
    this.io
      .to([rooms.hosts(game.id), rooms.player(game.id, answer.playerId)])
      .emit('answer:judged', toAnswerDto(game, answer));
  }

  songRevealed(game: Game, song: Song): void {
    this.io.to(rooms.game(game.id)).emit('song:revealed', toRevealDto(game, song));
  }

  scoreboardUpdated(game: Game): void {
    this.io.to(rooms.game(game.id)).emit('scoreboard:updated', toPublicScoreboard(game));
  }

  gameFinished(game: Game): void {
    this.io.to(rooms.game(game.id)).emit('game:finished', toPublicScoreboard(game));
  }
}
