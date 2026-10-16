import art from './artwork.json';
import {MicroscopeLab} from './live';
import type {Projection} from '@/components/iso/iso-kit';
export function MicroscopeArt(){return <MicroscopeLab projection={art.P as Projection} parts={art.parts} count={art.count} artwork={<div key="microscope-art" className="ml-art" dangerouslySetInnerHTML={{__html:art.svg}}/>}/>;}
