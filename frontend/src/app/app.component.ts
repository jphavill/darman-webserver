import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Project {
  title: string;
  description: string;
  tags: string[];
  type: 'github' | 'cad' | 'printing';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <header>
        <h1>Jason Havill</h1>
        <p class="subtitle">Software Engineer & Maker</p>
        <a href="https://github.com/jphavill" target="_blank" class="github-link">
          <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          &#64;jphavill
        </a>
      </header>

      <section>
        <h2>Software Projects</h2>
        <div class="projects-grid">
          @for (project of githubProjects; track project.title) {
            <div class="project-card">
              <h3>{{ project.title }}</h3>
              <p>{{ project.description }}</p>
              <div class="tags">
                @for (tag of project.tags; track tag) {
                  <span class="tag github">{{ tag }}</span>
                }
              </div>
            </div>
          }
        </div>
      </section>

      <section>
        <h2>Physical Projects</h2>
        <div class="projects-grid">
          @for (project of cadProjects; track project.title) {
            <div class="project-card">
              <h3>{{ project.title }}</h3>
              <p>{{ project.description }}</p>
              <div class="tags">
                @for (tag of project.tags; track tag) {
                  <span class="tag printing">{{ tag }}</span>
                }
              </div>
            </div>
          }
        </div>
      </section>

      <footer>
        <p>Built with Angular & deployed via Cloudflare Tunnel</p>
      </footer>
    </div>
  `
})
export class AppComponent {
  githubProjects: Project[] = [
    {
      title: 'My First Project',
      description: 'Add your first GitHub project here. Update the data in app.component.ts',
      tags: ['Python', 'API'],
      type: 'github'
    },
    {
      title: 'Web Application',
      description: 'Another project to showcase. Edit the component to add more.',
      tags: ['TypeScript', 'Angular'],
      type: 'github'
    }
  ];

  cadProjects: Project[] = [
    {
      title: 'Custom 3D Print',
      description: 'Add your 3D printing projects here. Include STL files or photos.',
      tags: ['Fusion 360', 'Prusa', 'PLA'],
      type: 'printing'
    },
    {
      title: 'Mechanical Design',
      description: 'Showcase your CAD assemblies and designs.',
      tags: ['Onshape', 'SOLIDWORKS'],
      type: 'cad'
    }
  ];
}
