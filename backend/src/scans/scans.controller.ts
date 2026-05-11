import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { Request } from 'express';
import { ScansService } from './scans.service';
import { AnalysisService } from '../analysis/analysis.service';

const UPLOADS_DIR = './uploads';
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

@Controller('scans')
export class ScansController {
  constructor(
    private readonly scans: ScansService,
    private readonly analysis: AnalysisService,
  ) {}

  @Get()
  list() {
    return this.scans.findAll();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.scans.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.scans.remove(id);
    return { success: true };
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => {
          const ext = (extname(file.originalname) || '.jpg').toLowerCase();
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
          cb(
            new BadRequestException(
              'Only JPEG, PNG, or WebP images are allowed',
            ) as unknown as Error,
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Image file is required');

    const result = await this.analysis.analyzeLabel(file.path, file.mimetype);

    const host = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${host}/uploads/${file.filename}`;

    return this.scans.create({
      productName: result.product?.name ?? null,
      imagePath: file.path,
      imageUrl,
      nutrition: result.nutrition ?? {},
      ingredients: result.ingredients ?? [],
      redFlagIngredients: result.red_flag_ingredients ?? null,
      verdict: result.verdict,
      extractionConfidence: result.extraction_confidence,
    });
  }
}
