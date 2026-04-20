import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ProjectEditorFormValue {
  title: string;
  type: 'software' | 'physical';
  isPublished: boolean;
  shortDescription: string;
  longDescription: string;
}

export interface ProjectEditorImageItem {
  id: string;
  previewUrl: string;
  altText: string;
  caption: string;
  isHero: boolean;
}

export interface ProjectEditorImagePatchEvent {
  imageId: string;
  patch: {
    altText?: string;
    caption?: string;
  };
}

@Component({
  selector: 'app-project-editor-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './project-editor-form.component.html',
  styleUrls: ['./project-editor-form.component.css']
})
export class ProjectEditorFormComponent {
  readonly imageTokenAlignExample = '[image:<image-id> align=right width=320 caption="Short caption"]';

  @Input({ required: true }) value!: ProjectEditorFormValue;
  @Input({ required: true }) images: ProjectEditorImageItem[] = [];
  @Input() maxImages = 12;
  @Input() fileInputDisabled = false;
  @Input() uploadHint = 'Choose one or more files to queue. Set hero, alt text, and caption per image below.';

  @Output() valueChange = new EventEmitter<ProjectEditorFormValue>();
  @Output() filesSelected = new EventEmitter<File[]>();
  @Output() imagePatched = new EventEmitter<ProjectEditorImagePatchEvent>();
  @Output() setHeroRequested = new EventEmitter<{ imageId: string; isHero: boolean }>();
  @Output() moveRequested = new EventEmitter<{ imageId: string; direction: -1 | 1 }>();
  @Output() deleteRequested = new EventEmitter<string>();

  patchValue(partial: Partial<ProjectEditorFormValue>): void {
    this.valueChange.emit({
      ...this.value,
      ...partial
    });
  }

  onFileSelection(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = input?.files;
    if (!files || files.length === 0) {
      return;
    }

    this.filesSelected.emit(Array.from(files));

    if (input) {
      input.value = '';
    }
  }

  requestSetHero(image: ProjectEditorImageItem): void {
    this.setHeroRequested.emit({ imageId: image.id, isHero: !image.isHero });
  }

  patchImage(imageId: string, patch: { altText?: string; caption?: string }): void {
    this.imagePatched.emit({ imageId, patch });
  }

  requestMove(imageId: string, direction: -1 | 1): void {
    this.moveRequested.emit({ imageId, direction });
  }

  requestDelete(imageId: string): void {
    this.deleteRequested.emit(imageId);
  }

  buildImageToken(imageId: string): string {
    return `[image:${imageId}]`;
  }
}
